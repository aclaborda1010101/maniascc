// Edge function: genera embeddings (text-embedding-3-small, 1536 dims)
// para todos los chunks de un documento que no los tengan.
// Llamada típica: { documento_id }.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBED_MODEL = "text-embedding-3-small";
const EMBED_DIM = 1536;
const BATCH = 50; // OpenAI permite hasta ~2048 inputs por call, vamos conservadores

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  // OpenAI embeddings endpoint (mismo contrato que el de Lovable AI Gateway si fuese)
  const resp = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts.map((t) => t.slice(0, 8000)), // safety
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`OpenAI embeddings ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.data || []).map((d: any) => d.embedding as number[]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_KEY) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const documento_id: string | undefined = body.documento_id;
    const question: string | undefined = body.question; // modo "embed query"

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Modo 1: embed de una query (para búsqueda híbrida) ---
    if (question) {
      const [vec] = await embedTexts([question], OPENAI_KEY);
      return new Response(JSON.stringify({ embedding: vec, model: EMBED_MODEL, dim: EMBED_DIM }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Modo 2: embed de chunks de un documento ---
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id or question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Trae chunks sin embedding
    const { data: chunks, error } = await admin
      .from("document_chunks")
      .select("id, contenido")
      .eq("documento_id", documento_id)
      .is("embedding", null)
      .order("chunk_index")
      .limit(500);

    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return new Response(JSON.stringify({ ok: true, embedded: 0, reason: "no chunks pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let embedded = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vecs = await embedTexts(
        slice.map((c) => c.contenido || ""),
        OPENAI_KEY
      );
      // Update fila a fila (postgres no soporta bulk de tipos vector vía supabase-js trivialmente)
      const updates = slice.map((c, j) =>
        admin.from("document_chunks").update({ embedding: vecs[j] as never }).eq("id", c.id)
      );
      await Promise.allSettled(updates);
      embedded += slice.length;
    }

    return new Response(
      JSON.stringify({ ok: true, embedded, documento_id, model: EMBED_MODEL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("rag-embed-chunks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
