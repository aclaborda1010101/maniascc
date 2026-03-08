import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Map document tipo_documento to RAG domain */
function inferDomain(tipoDoc: string | null, mimeType: string | null): string {
  const t = (tipoDoc || "").toLowerCase();
  // Contratos
  if (["contrato", "contrato_arrendamiento", "clausula", "addendum"].includes(t)) return "contratos";
  // Operadores
  if (["ficha_operador", "propuesta_operador", "dossier_operador", "perfil_operador"].includes(t)) return "operadores";
  // Activos
  if (["tasacion", "plano", "catastro", "ficha_activo", "informe_activo"].includes(t)) return "activos";
  // Mercado
  if (["informe_mercado", "estudio_mercado", "paper", "informe_sectorial"].includes(t)) return "mercado";
  // Personas
  if (["perfil_contacto", "notas_reunion", "acta", "comunicacion"].includes(t)) return "personas";
  // Dossier / propuesta → activos
  if (["dossier", "propuesta"].includes(t)) return "activos";
  // Default
  return "general";
}

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
    if (mime.includes("text") || mime.includes("json") || mime.includes("csv") || mime.includes("xml")) {
      text = await fileData.text();
    } else if (mime.includes("pdf")) {
      const raw = await fileData.text();
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

    // Insert new chunks with domain
    const rows = chunks.map((contenido, i) => ({
      documento_id: doc.id,
      proyecto_id: doc.proyecto_id,
      contenido,
      chunk_index: i,
      dominio,
      metadata: { nombre: doc.nombre, mime_type: mime, tipo_documento: doc.tipo_documento },
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
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
