import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * AVA attachment processor.
 * Takes a storage path inside `ava_attachments`, downloads the file,
 * sends it to Lovable AI multimodal (gemini-2.5-flash) and returns
 * extracted text + a short executive summary so the orchestrator
 * can inject it into the next chat turn as context.
 *
 * Body: { storage_path: string, mime_type: string, file_name: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storage_path, mime_type, file_name } = body;
    if (!storage_path) {
      return new Response(JSON.stringify({ error: "storage_path requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Security: ensure path belongs to the user
    if (!storage_path.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "Path no autorizado" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download file
    const { data: fileData, error: dlErr } = await admin.storage
      .from("ava_attachments")
      .download(storage_path);

    if (dlErr || !fileData) {
      return new Response(JSON.stringify({ error: "No se pudo descargar el archivo: " + (dlErr?.message || "desconocido") }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64
    const arrayBuf = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    let binary = "";
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
    }
    const base64 = btoa(binary);
    const mt = mime_type || "application/octet-stream";

    // Build multimodal message (Lovable AI Gemini accepts inline_data)
    const isImage = mt.startsWith("image/");
    const isPdf = mt === "application/pdf";
    const isText = mt.startsWith("text/") || mt === "application/json" || mt.includes("csv");

    let extractedText = "";
    let summary = "";

    if (isText) {
      // Plain text path: decode directly
      try {
        extractedText = new TextDecoder("utf-8").decode(bytes).slice(0, 60_000);
      } catch {
        extractedText = "";
      }
    }

    // Use Lovable AI for everything else (images / PDF / Office)
    if (!extractedText && (isImage || isPdf || mt.includes("officedocument") || mt.includes("msword") || mt.includes("excel") || mt.includes("spreadsheet"))) {
      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Eres un extractor de contenido documental. Lee el archivo adjunto y devuelve EXCLUSIVAMENTE el contenido textual relevante (texto, tablas en formato markdown, datos clave). NO inventes nada. NO añadas comentarios ni introducciones. Devuelve directamente el contenido.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: `Archivo: ${file_name || storage_path}. Extrae todo su contenido textual de forma estructurada.` },
                {
                  type: "image_url",
                  image_url: { url: `data:${mt};base64,${base64}` },
                },
              ],
            },
          ],
        }),
      });

      if (aiResp.ok) {
        const aiData = await aiResp.json();
        extractedText = (aiData.choices?.[0]?.message?.content || "").slice(0, 60_000);
      } else {
        const errBody = await aiResp.text();
        console.error("AI extract failed:", aiResp.status, errBody.slice(0, 300));
        extractedText = `[No se pudo extraer contenido del archivo: ${aiResp.status}]`;
      }
    }

    // Quick exec summary (cheap)
    if (extractedText && extractedText.length > 200) {
      try {
        const sumResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              { role: "system", content: "Resume en 3-5 bullets el documento. Español, conciso, factual. Solo bullets, sin intro." },
              { role: "user", content: extractedText.slice(0, 20_000) },
            ],
          }),
        });
        if (sumResp.ok) {
          const sd = await sumResp.json();
          summary = sd.choices?.[0]?.message?.content || "";
        }
      } catch (e) {
        console.warn("Summary failed:", e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      file_name: file_name || storage_path.split("/").pop(),
      mime_type: mt,
      extracted_text: extractedText,
      summary,
      length: extractedText.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ava-attach-process error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
