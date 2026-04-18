// Edge function: clasifica un documento por taxonomía + propone nombre normalizado.
// No requiere JWT explícito (gestionado por Lovable Cloud).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ClassifyRequest {
  documento_id: string;
  contenido_muestra?: string; // hasta 4000 chars del documento (front lo recorta)
}

interface ClassifyResult {
  taxonomia_codigo: string;
  nombre_normalizado: string;
  nivel_sensibilidad: "publico" | "interno" | "confidencial" | "restringido";
  fecha_documento?: string | null;
  resumen?: string;
  confidence: number;
}

const FALLBACK_TAXONOMIAS = [
  "activo", "operador", "operacion", "legal", "financiero",
  "presentacion", "correo", "whatsapp", "plano", "multimedia",
  "investigacion", "sin_clasificar",
];

function normalizeFilename(raw: string, taxonomia: string, fecha?: string | null): string {
  const ext = raw.includes(".") ? raw.slice(raw.lastIndexOf(".")) : "";
  let base = raw.replace(ext, "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
    .slice(0, 80);
  const datePart = fecha ? new Date(fecha).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return `${datePart}_${taxonomia}_${base || "documento"}${ext.toLowerCase()}`;
}

function ruleBasedFallback(nombre: string, mime?: string): ClassifyResult {
  const n = nombre.toLowerCase();
  let codigo = "sin_clasificar";
  if (/contrato|arrendamiento|loi|nda|escritura/.test(n)) codigo = "legal";
  else if (/factur|cashflow|p&l|valorac|presupuest/.test(n)) codigo = "financiero";
  else if (/plano|cad|dwg|arquitect/.test(n) || mime === "application/x-dwg") codigo = "plano";
  else if (/dossier|presentac|pitch/.test(n) || mime === "application/vnd.ms-powerpoint") codigo = "presentacion";
  else if (mime?.startsWith("image/") || mime?.startsWith("video/")) codigo = "multimedia";
  else if (mime === "message/rfc822" || /\.eml$/.test(n)) codigo = "correo";
  else if (/whatsapp|chat/.test(n)) codigo = "whatsapp";
  return {
    taxonomia_codigo: codigo,
    nombre_normalizado: normalizeFilename(nombre, codigo),
    nivel_sensibilidad: codigo === "legal" || codigo === "financiero" ? "confidencial" : "interno",
    confidence: 0.4,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body: ClassifyRequest = await req.json();
    if (!body.documento_id) {
      return new Response(JSON.stringify({ error: "documento_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: doc, error: docErr } = await supabase
      .from("documentos_proyecto")
      .select("id, nombre, mime_type, tamano_bytes, created_at")
      .eq("id", body.documento_id)
      .single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Documento no encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let result: ClassifyResult;

    if (LOVABLE_API_KEY) {
      const prompt = `Clasifica este documento inmobiliario.
Nombre: ${doc.nombre}
Mime: ${doc.mime_type || "?"}
Tamaño: ${doc.tamano_bytes || 0} bytes
Muestra contenido (primeras palabras):
${(body.contenido_muestra || "").slice(0, 3500)}

Devuelve JSON con: taxonomia_codigo (uno de: ${FALLBACK_TAXONOMIAS.join(", ")}), nombre_normalizado (snake_case con fecha YYYY-MM-DD si la detectas), nivel_sensibilidad (publico/interno/confidencial/restringido), fecha_documento (ISO o null), resumen (1 frase), confidence (0-1).`;

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Eres un clasificador documental experto en real estate. Responde SOLO con JSON válido." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        try {
          const parsed = JSON.parse(aiData.choices[0].message.content);
          if (!FALLBACK_TAXONOMIAS.includes(parsed.taxonomia_codigo)) parsed.taxonomia_codigo = "sin_clasificar";
          result = {
            taxonomia_codigo: parsed.taxonomia_codigo,
            nombre_normalizado: parsed.nombre_normalizado || normalizeFilename(doc.nombre, parsed.taxonomia_codigo, parsed.fecha_documento),
            nivel_sensibilidad: parsed.nivel_sensibilidad || "interno",
            fecha_documento: parsed.fecha_documento || null,
            resumen: parsed.resumen || null,
            confidence: parsed.confidence || 0.7,
          };
        } catch {
          result = ruleBasedFallback(doc.nombre, doc.mime_type || undefined);
        }
      } else {
        result = ruleBasedFallback(doc.nombre, doc.mime_type || undefined);
      }
    } else {
      result = ruleBasedFallback(doc.nombre, doc.mime_type || undefined);
    }

    // Persistir clasificación
    const { data: tax } = await supabase
      .from("documentos_taxonomia")
      .select("id")
      .eq("codigo", result.taxonomia_codigo)
      .maybeSingle();

    await supabase.from("documentos_proyecto").update({
      taxonomia_id: tax?.id || null,
      nombre_normalizado: result.nombre_normalizado,
      nivel_sensibilidad: result.nivel_sensibilidad,
      fecha_documento: result.fecha_documento || null,
      resumen_ia: result.resumen || null,
      procesado_ia: true,
    }).eq("id", body.documento_id);

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
