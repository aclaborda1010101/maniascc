import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Map document tipo_documento to RAG domain */
function inferDomain(tipoDoc: string | null, mimeType: string | null): string {
  const t = (tipoDoc || "").toLowerCase();
  if (["contrato", "contrato_arrendamiento", "clausula", "addendum"].includes(t)) return "contratos";
  if (["ficha_operador", "propuesta_operador", "dossier_operador", "perfil_operador"].includes(t)) return "operadores";
  if (["tasacion", "plano", "catastro", "ficha_activo", "informe_activo"].includes(t)) return "activos";
  if (["informe_mercado", "estudio_mercado", "paper", "informe_sectorial"].includes(t)) return "mercado";
  if (["perfil_contacto", "notas_reunion", "acta", "comunicacion"].includes(t)) return "personas";
  if (["dossier", "propuesta"].includes(t)) return "activos";
  return "general";
}

/** Check if file is plain text that can be read directly */
function isPlainText(mime: string): boolean {
  return mime.includes("text") || mime.includes("json") || mime.includes("csv") || mime.includes("xml");
}

/** Map common file extensions/mimes to Gemini-compatible mime types */
function geminiMimeType(mime: string, fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  // Gemini natively supports these
  const supported: Record<string, string> = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "gif": "image/gif",
    "webp": "image/webp",
    "doc": "application/msword",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "ppt": "application/vnd.ms-powerpoint",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xls": "application/vnd.ms-excel",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "csv": "text/csv",
    "txt": "text/plain",
    "html": "text/html",
    "msg": "application/vnd.ms-outlook",
    "eml": "message/rfc822",
  };
  if (supported[ext]) return supported[ext];
  if (mime && mime !== "application/octet-stream") return mime;
  return "application/octet-stream";
}

/** Extract text from a file using Google Gemini multimodal */
async function extractWithGemini(
  fileBase64: string,
  mimeType: string,
  fileName: string,
  apiKey: string
): Promise<string> {
  const resolvedMime = geminiMimeType(mimeType, fileName);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `Eres un extractor de documentos profesional especializado en el sector inmobiliario y centros comerciales en España. 
Tu tarea es extraer TODO el contenido textual del documento adjunto de forma estructurada y completa.

Reglas:
- Extrae absolutamente todo el texto, tablas, cifras, nombres, fechas, direcciones y datos relevantes
- Mantén la estructura del documento (títulos, secciones, listas)
- Si hay tablas, represéntalas de forma legible con formato de texto
- Si hay imágenes con texto (OCR), extrae ese texto también
- Si es un email (MSG/EML), extrae: remitente, destinatario, asunto, fecha, cuerpo y adjuntos mencionados
- Si es un plano o archivo técnico, describe lo que puedas interpretar
- Responde SOLO con el contenido extraído, sin comentarios ni explicaciones adicionales
- Idioma: mantén el idioma original del documento`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extrae todo el contenido textual del siguiente documento: "${fileName}"`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${resolvedMime};base64,${fileBase64}`
              }
            }
          ]
        }
      ],
      max_tokens: 16000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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

    const { documento_id, dominio: domainOverride } = await req.json();
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Fetch document metadata
    const { data: doc, error: docErr } = await admin
      .from("documentos_proyecto")
      .select("*")
      .eq("id", documento_id)
      .single();

    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: "Document not found" }), { status: 404, headers: corsHeaders });
    }

    // Determine RAG domain
    const dominio = domainOverride || inferDomain(doc.tipo_documento, doc.mime_type);

    // Download file from storage
    const { data: fileData, error: dlErr } = await admin.storage
      .from("documentos_contratos")
      .download(doc.storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "Could not download file: " + (dlErr?.message || "") }), {
        status: 500, headers: corsHeaders,
      });
    }

    // Extract text content
    let text = "";
    const mime = doc.mime_type || "";
    let extraction_method = "direct";

    if (isPlainText(mime)) {
      // Direct text reading for plain text files
      text = await fileData.text();
      extraction_method = "direct_text";
    } else {
      // Use Gemini multimodal for everything else (PDF, DOCX, PPTX, XLSX, images, MSG, EML, DWG, etc.)
      try {
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        // Convert to base64
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          const chunk = uint8.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);

        text = await extractWithGemini(base64, mime, doc.nombre, LOVABLE_API_KEY);
        extraction_method = "gemini_multimodal";

        // If Gemini returned empty or very short, add metadata fallback
        if (!text || text.trim().length < 20) {
          text = `[Documento: ${doc.nombre}. Tipo: ${mime}. Tamaño: ${doc.tamano_bytes || 0} bytes. Dominio: ${dominio}. Extracción automática no pudo obtener contenido textual significativo.]`;
          extraction_method = "metadata_fallback";
        }
      } catch (geminiErr) {
        console.error("Gemini extraction failed:", geminiErr);
        // Fallback: store metadata as chunk
        text = `[Documento: ${doc.nombre}. Tipo: ${mime}. Tamaño: ${doc.tamano_bytes || 0} bytes. Dominio: ${dominio}. Error en extracción: ${geminiErr instanceof Error ? geminiErr.message : "unknown"}]`;
        extraction_method = "error_fallback";
      }
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No extractable text" }), { status: 422, headers: corsHeaders });
    }

    // Sanitize: remove null bytes, invalid Unicode escape sequences, and other problematic chars
    text = text
      .replace(/\x00/g, "")
      .replace(/\\u0000/g, "")
      .replace(/\uFFFD/g, "")
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");

    // Chunk text (~500 tokens ≈ ~2000 chars, overlap ~200 chars)
    const CHUNK_SIZE = 2000;
    const OVERLAP = 200;
    const chunks: string[] = [];
    let pos = 0;
    while (pos < text.length) {
      chunks.push(text.slice(pos, pos + CHUNK_SIZE));
      pos += CHUNK_SIZE - OVERLAP;
    }

    // Delete old chunks for this document
    await admin.from("document_chunks").delete().eq("documento_id", documento_id);

    // Insert new chunks with domain
    const rows = chunks.map((contenido, i) => ({
      documento_id: doc.id,
      proyecto_id: doc.proyecto_id,
      contenido,
      chunk_index: i,
      dominio,
      metadata: { nombre: doc.nombre, mime_type: mime, tipo_documento: doc.tipo_documento, extraction_method },
    }));

    if (rows.length > 0) {
      const { error: insertErr } = await admin.from("document_chunks").insert(rows);
      if (insertErr) {
        return new Response(JSON.stringify({ error: "Insert error: " + insertErr.message }), {
          status: 500, headers: corsHeaders,
        });
      }
    }

    // Mark document as processed
    await admin.from("documentos_proyecto").update({ procesado_ia: true }).eq("id", documento_id);

    return new Response(JSON.stringify({
      success: true,
      chunks_created: rows.length,
      documento_id,
      dominio,
      extraction_method,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
