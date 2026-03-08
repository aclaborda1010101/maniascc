import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ForgeMode = "dossier_operador" | "presentacion_comercial" | "borrador_contrato" | "plan_estrategico" | "informe_war_room" | "email_comunicacion";

const MODE_PROMPTS: Record<ForgeMode, string> = {
  dossier_operador: `Eres FORGE, agente de generación de dossiers de operadores retail.
Genera un dossier completo y profesional del operador que incluya:
- Resumen ejecutivo
- Perfil del operador (sector, tamaño, presencia geográfica)
- Histórico de negociaciones y condiciones típicas
- Rango de precio aceptable estimado
- Requisitos técnicos y de superficie
- Puntos de negociación clave
- Recomendaciones estratégicas
Formato: Markdown profesional con secciones claras. Responde en español.`,

  presentacion_comercial: `Eres FORGE, agente de generación de presentaciones comerciales inmobiliarias.
Genera el contenido para una presentación comercial profesional que incluya:
- Slide de portada (título, subtítulo)
- Resumen ejecutivo del activo/proyecto
- Datos clave del mercado y la zona
- Propuesta de valor
- Tenant mix propuesto (si aplica)
- Proyecciones financieras
- Próximos pasos
Formato: Markdown con separadores de slide (---). Responde en español.`,

  borrador_contrato: `Eres FORGE, agente de redacción de borradores de contratos de arrendamiento.
Genera un borrador de contrato que incluya:
- Partes contratantes
- Objeto del contrato (descripción del local)
- Duración y renovación
- Renta y actualización
- Fianza y garantías
- Gastos y servicios
- Obras y mantenimiento
- Cesión y subarriendo
- Resolución y penalizaciones
⚠️ ADVERTENCIA: Este es un borrador orientativo. Debe ser revisado por un abogado antes de su uso.
Formato: Markdown con cláusulas numeradas. Responde en español.`,

  plan_estrategico: `Eres FORGE, agente de planificación estratégica de centros comerciales.
Genera un plan estratégico que incluya:
- Diagnóstico de situación actual (ocupación, mix, rendimiento)
- Análisis DAFO
- Objetivos estratégicos a 12-24 meses
- Plan de acción con operadores recomendados
- Cronograma de comercialización
- Proyección de ingresos
- Riesgos y mitigación
Formato: Markdown profesional. Responde en español.`,

  informe_war_room: `Eres FORGE, agente de informes ejecutivos para war room.
Genera un informe de estado ejecutivo que incluya:
- KPIs principales (ocupación, renta media, operaciones en curso)
- Estado de negociaciones activas
- Alertas y riesgos
- Oportunidades detectadas
- Decisiones pendientes
- Próximas acciones
Formato: Markdown conciso con tablas y bullets. Responde en español.`,

  email_comunicacion: `Eres FORGE, agente de comunicación profesional inmobiliaria.
Genera un email profesional adaptado al contexto y destinatario que incluya:
- Asunto sugerido
- Saludo personalizado
- Cuerpo del mensaje (directo, profesional, orientado a acción)
- Llamada a la acción clara
- Cierre profesional
Formato: Markdown con secciones de Asunto y Cuerpo. Responde en español.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { mode, context, proyecto_id } = await req.json() as {
      mode: ForgeMode;
      context: string;
      proyecto_id?: string;
    };

    if (!mode || !MODE_PROMPTS[mode]) {
      return new Response(JSON.stringify({ error: "Invalid mode. Valid: " + Object.keys(MODE_PROMPTS).join(", ") }), {
        status: 400, headers: corsHeaders,
      });
    }
    if (!context) {
      return new Response(JSON.stringify({ error: "context required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Optionally enrich with RAG context from relevant domains
    let ragContext = "";
    if (proyecto_id) {
      const domainMap: Record<ForgeMode, string[]> = {
        dossier_operador: ["operadores", "contratos"],
        presentacion_comercial: ["activos", "mercado"],
        borrador_contrato: ["contratos", "activos"],
        plan_estrategico: ["activos", "mercado", "operadores"],
        informe_war_room: ["general", "activos", "operadores"],
        email_comunicacion: ["personas", "operadores"],
      };

      const domains = domainMap[mode] || ["general"];
      const { data: chunks } = await admin
        .from("document_chunks")
        .select("contenido, dominio, metadata")
        .eq("proyecto_id", proyecto_id)
        .in("dominio", domains)
        .limit(8);

      if (chunks && chunks.length > 0) {
        ragContext = "\n\nCONTEXTO DE DOCUMENTOS DEL PROYECTO:\n" +
          chunks.map((c: any, i: number) => `[${c.dominio}: ${c.metadata?.nombre || "Doc"}]\n${c.contenido}`).join("\n---\n");
      }
    }

    // Select model based on mode complexity
    let model = "google/gemini-3-flash-preview";
    if (["borrador_contrato", "plan_estrategico"].includes(mode)) {
      model = "google/gemini-2.5-pro"; // More complex reasoning
    }

    const startMs = Date.now();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: MODE_PROMPTS[mode] },
          { role: "user", content: context + ragContext },
        ],
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, inténtalo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await aiResp.text();
      console.error("FORGE AI error:", status, body);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const latency = Date.now() - startMs;

    const content = aiData.choices?.[0]?.message?.content || "No se pudo generar el documento.";

    // Audit
    await admin.from("auditoria_ia").insert({
      funcion_ia: `forge:${mode}`,
      modelo: model,
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      content,
      mode,
      model,
      latency_ms: latency,
      tokens: {
        input: aiData.usage?.prompt_tokens || 0,
        output: aiData.usage?.completion_tokens || 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forge error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
