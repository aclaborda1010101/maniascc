import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOMAIN_SYSTEM_PROMPTS: Record<string, string> = {
  contratos: `Eres un experto legal en contratos de arrendamiento inmobiliario comercial.`,
  operadores: `Eres un analista especializado en operadores retail.`,
  activos: `Eres un experto en activos inmobiliarios comerciales.`,
  centros_comerciales: `Eres un experto en centros y parques comerciales.`,
  comunicaciones: `Eres un analista de comunicaciones y emails de negociación.`,
  mercado: `Eres un analista de mercado inmobiliario retail.`,
  personas: `Eres un experto en perfiles de negociación.`,
  general: `Eres un asistente experto en el sector inmobiliario comercial.`,
};

// Convierte el valor que devuelve la RPC `get_cached_embedding` (puede llegar como
// array directo o como string serializado de pgvector "[0.1,0.2,...]") a number[].
function parseEmbedding(raw: unknown): number[] | null {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function getQueryEmbedding(
  // deno-lint-ignore no-explicit-any
  admin: any,
  question: string,
  lovableKey: string,
): Promise<number[] | null> {
  if (!lovableKey) return null;

  // 1) Cache lookup (RPC SECURITY DEFINER)
  console.time("rag:embed:cache-lookup");
  try {
    const { data: cached, error } = await admin.rpc("get_cached_embedding", { p_query: question });
    console.timeEnd("rag:embed:cache-lookup");
    if (error) {
      console.warn("rag:embed: cache lookup error", error.message);
    } else {
      const parsed = parseEmbedding(cached);
      if (parsed && parsed.length > 0) {
        console.log(`rag:embed: HIT (${parsed.length}d)`);
        return parsed;
      }
    }
  } catch (err) {
    console.timeEnd("rag:embed:cache-lookup");
    console.warn("rag:embed: cache lookup failed", err);
  }

  // 2) Cache MISS → llamar al Lovable AI Gateway
  console.time("rag:embed:gateway");
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/text-embedding-004", input: question.slice(0, 8000) }),
    });
    console.timeEnd("rag:embed:gateway");
    if (!r.ok) {
      console.warn("rag:embed: gateway", r.status);
      return null;
    }
    const d = await r.json();
    const embedding: number[] | null = d.data?.[0]?.embedding ?? null;
    if (!embedding) return null;

    // 3) Fire-and-forget cache write (no bloquea respuesta)
    admin
      .rpc("cache_query_embedding", { p_query: question, p_embedding: embedding })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn("rag:embed: cache write failed", error);
      });

    return embedding;
  } catch (err) {
    console.timeEnd("rag:embed:gateway");
    console.warn("rag:embed: gateway exception", err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getUser();
    if (!claims.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { question, filters } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const proyectoId = filters?.proyecto_id;
    const dominio = filters?.dominio && filters.dominio !== "todos" ? filters.dominio : null;
    const dominios: string[] | null = Array.isArray(filters?.dominios) && filters.dominios.length > 0
      ? filters.dominios.filter((d: any) => typeof d === "string" && d.length > 0)
      : null;
    const userId = claims.user.id;
    const visibilityOr = `visibility.in.(shared,global),owner_id.eq.${userId}`;

    let contextChunks: any[] = [];
    const queryEmbedding = await embedQuery(question, LOVABLE_API_KEY);

    if (queryEmbedding) {
      const rpcArgs: Record<string, unknown> = {
        p_question: question,
        p_query_embedding: queryEmbedding as never,
        p_dominio: dominios ? null : dominio,
        p_proyecto_id: proyectoId || null,
        p_limit: 20,
      };
      if (dominios) rpcArgs.p_dominios = dominios;
      const { data: hybrid } = await admin.rpc("rag_hybrid_search", rpcArgs as never);
      contextChunks = (hybrid || []).filter((c: any) =>
        c.owner_id === userId || ["shared", "global"].includes(c.visibility)
      );
    }

    if (contextChunks.length === 0) {
      let q = admin
        .from("document_chunks")
        .select("id, contenido, chunk_index, metadata, documento_id, dominio")
        .textSearch("contenido", question, { type: "websearch", config: "spanish" })
        .or(visibilityOr)
        .limit(15);
      if (proyectoId) q = q.eq("proyecto_id", proyectoId);
      if (dominios) q = q.in("dominio", dominios);
      else if (dominio) q = q.eq("dominio", dominio);
      const { data } = await q;
      contextChunks = data || [];
    }

    if (contextChunks.length === 0) {
      const words = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
      if (words.length > 0) {
        let fb = admin
          .from("document_chunks")
          .select("id, contenido, chunk_index, metadata, documento_id, dominio")
          .ilike("contenido", `%${words[0]}%`)
          .or(visibilityOr)
          .limit(10);
        if (proyectoId) fb = fb.eq("proyecto_id", proyectoId);
        if (dominios) fb = fb.in("dominio", dominios);
        else if (dominio) fb = fb.eq("dominio", dominio);
        const { data } = await fb;
        contextChunks = data || [];
      }
    }

    if (contextChunks.length === 0) {
      return new Response(JSON.stringify({
        answer: "No se encontraron documentos relevantes. Asegúrate de haber subido e indexado documentos.",
        citations: [],
        confidence: 0,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Top-10 por hybrid_score (si viene) o tal cual
    contextChunks = contextChunks.slice(0, 10);

    // Resolver nombres de documentos
    const docIds = [...new Set(contextChunks.map((c: any) => c.documento_id).filter(Boolean))];
    const { data: docs } = docIds.length > 0
      ? await admin.from("documentos_proyecto").select("id, nombre").in("id", docIds)
      : { data: [] as { id: string; nombre: string }[] };
    const docName = new Map((docs || []).map((d: any) => [d.id, d.nombre]));

    const domainCounts: Record<string, number> = {};
    for (const c of contextChunks) {
      const d = c.dominio || "general";
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }
    const dominantDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";
    const sysPrompt = DOMAIN_SYSTEM_PROMPTS[dominantDomain] || DOMAIN_SYSTEM_PROMPTS.general;

    const context = contextChunks.map((c: any, i: number) => {
      const name = docName.get(c.documento_id) || c.metadata?.nombre || "Documento";
      return `[Fuente ${i + 1}: "${name}", fragmento ${c.chunk_index ?? "?"}]\n${c.contenido}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `${sysPrompt}
Responde SIEMPRE en español. Basa tu respuesta ÚNICAMENTE en los fragmentos proporcionados.
Si no está en los documentos, dilo claramente. Sé conciso y profesional.`;

    const userPrompt = `CONTEXTO (${dominantDomain}):

${context}

---

PREGUNTA: ${question}`;

    const startMs = Date.now();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rag_response",
            description: "Respuesta RAG estructurada",
            parameters: {
              type: "object",
              properties: {
                answer: { type: "string" },
                cited_sources: {
                  type: "array",
                  items: { type: "integer" },
                  description: "Índices (1-based) de las fuentes realmente usadas",
                },
                confidence: { type: "number" },
              },
              required: ["answer", "cited_sources", "confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rag_response" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) return new Response(JSON.stringify({ error: "Límite de peticiones excedido." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (status === 402) return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error(`AI gateway ${status}`);
    }

    const aiData = await aiResp.json();
    const latency = Date.now() - startMs;
    const tc = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: { answer: string; cited_sources: number[]; confidence: number };
    if (tc?.function?.arguments) {
      const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
      parsed = { answer: args.answer || "", cited_sources: args.cited_sources || [], confidence: args.confidence ?? 0.5 };
    } else {
      parsed = { answer: aiData.choices?.[0]?.message?.content || "", cited_sources: [], confidence: 0.4 };
    }

    // Construir citas con documento_id
    const citations = (parsed.cited_sources.length > 0 ? parsed.cited_sources : contextChunks.map((_, i) => i + 1))
      .map((idx) => {
        const c = contextChunks[idx - 1];
        if (!c) return null;
        return {
          documento_id: c.documento_id,
          nombre: docName.get(c.documento_id) || c.metadata?.nombre || "Documento",
          chunk_index: c.chunk_index,
        };
      })
      .filter(Boolean)
      // dedup por documento_id
      .filter((v: any, i: number, a: any[]) => a.findIndex((x) => x.documento_id === v.documento_id) === i);

    await admin.from("auditoria_ia").insert({
      funcion_ia: `rag-proxy:${dominantDomain}`,
      modelo: "google/gemini-2.5-flash",
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      answer: parsed.answer,
      citations,
      confidence: parsed.confidence,
      domain: dominantDomain,
      domains_found: Object.keys(domainCounts),
      hybrid: !!queryEmbedding,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
