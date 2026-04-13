import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  const { mode } = await req.json().catch(() => ({ mode: "check" }));

  // Get pending docs
  const { data: docs, error } = await admin
    .from("documentos_proyecto")
    .select("id, nombre, mime_type, tamano_bytes, storage_path, proyecto_id, tipo_documento")
    .eq("procesado_ia", false)
    .order("tamano_bytes", { ascending: true, nullsFirst: true });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (mode === "check") {
    // Just check which exist vs orphan
    const results = [];
    for (const doc of docs || []) {
      const { error: dlErr } = await admin.storage
        .from("documentos_contratos")
        .download(doc.storage_path);
      results.push({
        id: doc.id,
        nombre: doc.nombre,
        size: doc.tamano_bytes,
        exists: !dlErr,
      });
    }
    return new Response(JSON.stringify({ total: docs?.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // mode === "process" - actually process documents
  const results: Array<{ id: string; nombre: string; status: string; chunks?: number; error?: string }> = [];
  const limit = 2; // Process max 2 at a time
  const toProcess = (docs || []).slice(0, limit);

  for (const doc of toProcess) {
    try {
      // Download file
      const { data: fileData, error: dlErr } = await admin.storage
        .from("documentos_contratos")
        .download(doc.storage_path);

      if (dlErr || !fileData) {
        await admin.from("documentos_proyecto")
          .update({ procesado_ia: true, resumen_ia: "[Archivo no encontrado en storage]" })
          .eq("id", doc.id);
        results.push({ id: doc.id, nombre: doc.nombre, status: "orphan" });
        continue;
      }

      const mime = doc.mime_type || "";
      let text = "";
      let extraction_method = "direct";

      const isPlainText = mime.includes("text") || mime.includes("json") || mime.includes("csv") || mime.includes("xml");

      if (isPlainText) {
        text = await fileData.text();
        extraction_method = "direct_text";
      } else {
        // Convert to base64
        const arrayBuffer = await fileData.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 8192;
        for (let i = 0; i < uint8.length; i += chunkSize) {
          const chunk = uint8.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binary);

        // Check size
        if (base64.length > 20 * 1024 * 1024) {
          text = `[Documento: ${doc.nombre}. Tipo: ${mime}. Tamaño: ${doc.tamano_bytes || 0} bytes. Archivo demasiado grande para extracción multimodal.]`;
          extraction_method = "size_fallback";
        } else {
          // Call Gemini
          const ext = doc.nombre.split(".").pop()?.toLowerCase() || "";
          const mimeMap: Record<string, string> = {
            "pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "msg": "application/vnd.ms-outlook", "eml": "message/rfc822",
          };
          const resolvedMime = mimeMap[ext] || mime || "application/octet-stream";

          try {
            const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${LOVABLE_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: `Eres un extractor de documentos profesional. Extrae TODO el contenido textual del documento adjunto de forma estructurada y completa. Solo responde con el contenido extraído.`
                  },
                  {
                    role: "user",
                    content: [
                      { type: "text", text: `Extrae todo el contenido textual de: "${doc.nombre}"` },
                      { type: "image_url", image_url: { url: `data:${resolvedMime};base64,${base64}` } }
                    ]
                  }
                ],
                max_tokens: 16000,
                temperature: 0.1,
              }),
            });

            if (!response.ok) {
              const errText = await response.text();
              throw new Error(`Gemini ${response.status}: ${errText.substring(0, 200)}`);
            }

            const data = await response.json();
            text = data.choices?.[0]?.message?.content || "";
            extraction_method = "gemini_multimodal";

            if (!text || text.trim().length < 20) {
              text = `[Documento: ${doc.nombre}. Tipo: ${mime}. Tamaño: ${doc.tamano_bytes || 0} bytes.]`;
              extraction_method = "metadata_fallback";
            }
          } catch (geminiErr) {
            console.error(`Gemini failed for ${doc.nombre}:`, geminiErr);
            text = `[Documento: ${doc.nombre}. Tipo: ${mime}. Error: ${geminiErr instanceof Error ? geminiErr.message : "unknown"}]`;
            extraction_method = "error_fallback";
          }
        }
      }

      // Sanitize
      text = text
        .replace(/\x00/g, "").replace(/\\u0000/g, "").replace(/\uFFFD/g, "")
        .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F]/g, "");

      if (!text || text.trim().length === 0) {
        results.push({ id: doc.id, nombre: doc.nombre, status: "empty" });
        continue;
      }

      // Chunk
      const CHUNK_SIZE = 2000;
      const OVERLAP = 200;
      const chunks: string[] = [];
      let pos = 0;
      while (pos < text.length) {
        chunks.push(text.slice(pos, pos + CHUNK_SIZE));
        pos += CHUNK_SIZE - OVERLAP;
      }

      // Delete old chunks
      await admin.from("document_chunks").delete().eq("documento_id", doc.id);

      // Determine domain
      const t = (doc.tipo_documento || "").toLowerCase();
      let dominio = "general";
      if (["contrato", "contrato_arrendamiento"].includes(t)) dominio = "contratos";
      else if (["ficha_operador", "propuesta_operador"].includes(t)) dominio = "operadores";

      // Insert chunks
      const safeName = (doc.nombre || "").replace(/[\x00-\x1F\x7F]/g, "");
      let insertedCount = 0;
      for (const [i, contenido] of chunks.entries()) {
        const row = {
          documento_id: doc.id,
          proyecto_id: doc.proyecto_id,
          contenido,
          chunk_index: i,
          dominio,
          metadata: { nombre: safeName, mime_type: mime, extraction_method },
        };
        const { error: insertErr } = await admin.from("document_chunks").insert(row);
        if (insertErr) {
          const sanitized = { ...row, contenido: contenido.replace(/[^\x20-\x7E\xA0-\uFFFF\n\r\t]/g, " ") };
          const { error: retryErr } = await admin.from("document_chunks").insert(sanitized);
          if (!retryErr) insertedCount++;
        } else {
          insertedCount++;
        }
      }

      // Mark as processed
      await admin.from("documentos_proyecto").update({ procesado_ia: true }).eq("id", doc.id);
      results.push({ id: doc.id, nombre: doc.nombre, status: "ok", chunks: insertedCount });
    } catch (e) {
      results.push({ id: doc.id, nombre: doc.nombre, status: "error", error: e instanceof Error ? e.message : "unknown" });
    }
  }

  const remaining = (docs?.length || 0) - toProcess.length;
  return new Response(JSON.stringify({ processed: results.length, remaining, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
