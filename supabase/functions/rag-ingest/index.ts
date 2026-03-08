import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { documento_id } = await req.json();
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
    if (mime.includes("text") || mime.includes("json") || mime.includes("csv") || mime.includes("xml")) {
      text = await fileData.text();
    } else if (mime.includes("pdf")) {
      // Basic PDF text extraction - extract text between stream markers
      const raw = await fileData.text();
      // Simple heuristic: grab readable ASCII runs
      const readable = raw.replace(/[^\x20-\x7E\xC0-\xFF\n\r\t]/g, " ");
      text = readable.replace(/\s{3,}/g, "\n").trim();
      if (text.length < 50) {
        text = `[PDF document: ${doc.nombre}. Text extraction limited. File size: ${doc.tamano_bytes || 0} bytes]`;
      }
    } else {
      text = `[Binary document: ${doc.nombre}. Type: ${mime}. Size: ${doc.tamano_bytes || 0} bytes]`;
    }

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "No extractable text" }), { status: 422, headers: corsHeaders });
    }

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

    // Insert new chunks
    const rows = chunks.map((contenido, i) => ({
      documento_id: doc.id,
      proyecto_id: doc.proyecto_id,
      contenido,
      chunk_index: i,
      metadata: { nombre: doc.nombre, mime_type: mime },
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
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
