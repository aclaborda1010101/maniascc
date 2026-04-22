// Edge function: genera embeddings (Gemini text-embedding-004, 768 dims)
// vía Lovable AI Gateway, para todos los chunks de un documento que no los tengan.
// Llamada típica: { documento_id }  o  { question } para embed de query.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMBED_MODEL = "google/text-embedding-004";
const EMBED_DIM = 768;
const BATCH = 50;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

async function embedTexts(texts: string[], apiKey: string): Promise<number[][]> {
  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts.map((t) => (t || "").slice(0, 8000)),
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Lovable AI embeddings ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = await resp.json();
  return (data.data || []).map((d: any) => d.embedding as number[]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const documento_id: string | undefined = body.documento_id;
    const question: string | undefined = body.question;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // --- Modo 1: embed de una query (para búsqueda híbrida) ---
    if (question) {
      const [vec] = await embedTexts([question], LOVABLE_API_KEY);
      return new Response(
        JSON.stringify({ embedding: vec, model: EMBED_MODEL, dim: EMBED_DIM }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Modo 2: embed de chunks de un documento ---
    if (!documento_id) {
      return new Response(JSON.stringify({ error: "documento_id or question required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: chunks, error } = await admin
      .from("document_chunks")
      .select("id, contenido")
      .eq("documento_id", documento_id)
      .is("embedding", null)
      .order("chunk_index")
      .limit(2000);

    if (error) throw error;
    if (!chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, embedded: 0, reason: "no chunks pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let embedded = 0;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const vecs = await embedTexts(
        slice.map((c) => c.contenido || ""),
        LOVABLE_API_KEY
      );
      const updates = slice.map((c, j) =>
        admin.from("document_chunks").update({ embedding: vecs[j] as never }).eq("id", c.id)
      );
      await Promise.allSettled(updates);
      embedded += slice.length;
    }

    return new Response(
      JSON.stringify({ ok: true, embedded, documento_id, model: EMBED_MODEL, dim: EMBED_DIM }),
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
