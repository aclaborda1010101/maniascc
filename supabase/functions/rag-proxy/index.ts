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

// Modelo de embedding usado para indexar todos los chunks (768d, compatible con HNSW existente).
// El Lovable AI Gateway no expone modelos de embedding, por lo que usamos Google AI Studio
// directamente con la misma API key que `rag-embed-chunks`.
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIM = 768;
const GOOGLE_EMBED_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent`;

async function getQueryEmbedding(
  // deno-lint-ignore no-explicit-any
  admin: any,
  question: string,
  googleKey: string,
): Promise<number[] | null> {
  if (!googleKey) return null;

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

  // 2) Cache MISS → llamar a Google AI Studio
  console.time("rag:embed:google");
  try {
    const r = await fetch(`${GOOGLE_EMBED_URL}?key=${googleKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBED_MODEL}`,
        content: { parts: [{ text: question.slice(0, 8000) }] },
        outputDimensionality: EMBED_DIM,
      }),
    });
    console.timeEnd("rag:embed:google");
    if (!r.ok) {
      const errText = await r.text().catch(() => "<no body>");
      console.warn(`rag:embed: google ${r.status} body=${errText.slice(0, 300)}`);
      return null;
    }
    const d = await r.json();
    const embedding: number[] | null = d.embedding?.values ?? null;
    if (!embedding || embedding.length === 0) {
      console.warn("rag:embed: google returned empty embedding");
      return null;
    }

    // 3) Fire-and-forget cache write (no bloquea respuesta)
    admin
      .rpc("cache_query_embedding", { p_query: question, p_embedding: embedding })
      .then(({ error }: { error: unknown }) => {
        if (error) console.warn("rag:embed: cache write failed", error);
      });

    return embedding;
  } catch (err) {
    console.timeEnd("rag:embed:google");
    console.warn("rag:embed: google exception", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rerank de candidatos con LLM (Gemini flash vía Lovable AI Gateway).
// Devuelve los índices ordenados por relevancia real a la pregunta.
// Preparado para migrar a Cohere Rerank si COHERE_API_KEY estuviera presente.
// ---------------------------------------------------------------------------
async function rerankCandidates(
  question: string,
  candidates: { contenido: string }[],
  lovableKey: string,
  timeoutMs = 6000,
): Promise<{ order: number[]; scores: number[]; latency_ms: number; tokens_in: number; tokens_out: number } | null> {
  const cohereKey = Deno.env.get("COHERE_API_KEY");
  if (cohereKey) {
    // TODO: sustituir por llamada a Cohere Rerank v3 cuando se configure la key.
    // Por ahora seguimos con el reranker LLM.
  }
  const numbered = candidates.map((c, i) =>
    `[${i + 1}] ${(c.contenido || "").slice(0, 500).replace(/\s+/g, " ").trim()}`
  ).join("\n\n");

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Eres un reranker. Ordena los fragmentos por relevancia REAL a la pregunta. Ignora relleno." },
          { role: "user", content: `PREGUNTA: ${question}\n\nFRAGMENTOS:\n${numbered}` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rerank",
            description: "Devuelve el ranking de relevancia",
            parameters: {
              type: "object",
              properties: {
                ranking: { type: "array", items: { type: "integer" }, description: "Índices 1-based ordenados por relevancia DESC" },
                scores:  { type: "array", items: { type: "number" },  description: "Score 0-1 alineado con ranking" },
              },
              required: ["ranking", "scores"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rerank" } },
      }),
    });
    clearTimeout(to);
    if (!r.ok) { console.warn(`rag:rerank status ${r.status}`); return null; }
    const j = await r.json();
    const tc = j.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc?.function?.arguments) return null;
    const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
    const order: number[] = (args.ranking || []).map((n: number) => n - 1).filter((n: number) => n >= 0 && n < candidates.length);
    const scores: number[] = args.scores || [];
    return {
      order,
      scores,
      latency_ms: Date.now() - t0,
      tokens_in: j.usage?.prompt_tokens || 0,
      tokens_out: j.usage?.completion_tokens || 0,
    };
  } catch (e) {
    clearTimeout(to);
    console.warn("rag:rerank error/timeout", e instanceof Error ? e.message : e);
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
    const GOOGLE_AI_API_KEY = Deno.env.get("GOOGLE_AI_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");
    if (!GOOGLE_AI_API_KEY) console.warn("GOOGLE_AI_API_KEY not configured — RAG will fall back to FTS only");

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
    // Filtro DURO: solo cuando el frontend lo pasa explícitamente (p.ej. desde ficha de proyecto).
    const explicitProyectoId: string | null = filters?.proyecto_id || null;
    // Pista textual: proyecto adivinado del texto de la pregunta. NO se usa como filtro.
    let resolvedProyecto: { id: string; nombre: string } | null = null;
    let proyectoId: string | null = explicitProyectoId;

    // Auto-resolver proyecto por nombre (SOLO pista textual, NO filtro).
    // Antes: se usaba como p_proyecto_id y cegaba la búsqueda (ej. 875 chunks NULL
    // sobre La Milla quedaban excluidos). Ahora se guarda en resolvedProyecto para
    // metadata/UX pero NO se aplica como filtro duro.
    if (!explicitProyectoId) {
      try {
        const { data: proyectos } = await admin
          .from("proyectos")
          .select("id, nombre")
          .limit(500);
        if (proyectos && proyectos.length > 0) {
          const norm = (s: string) =>
            s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const STOP = new Set(["de","la","el","los","las","del","y","en","a"]);
          const qn = norm(question);
          const sorted = [...proyectos].sort((a: any, b: any) => (b.nombre?.length || 0) - (a.nombre?.length || 0));
          for (const p of sorted) {
            const pn = norm(p.nombre || "");
            if (pn.length < 4) continue;
            if (qn.includes(pn)) {
              resolvedProyecto = { id: p.id, nombre: p.nombre };
              console.log(`rag:proyecto-resolved exact (hint only): "${p.nombre}"`); break;
            }
            const tokens = pn.split(/\s+/).filter((t) => t.length >= 3 && !STOP.has(t));
            if (tokens.length >= 2 && tokens.every((t) => qn.includes(t))) {
              resolvedProyecto = { id: p.id, nombre: p.nombre };
              console.log(`rag:proyecto-resolved tokens (hint only): "${p.nombre}"`); break;
            }
          }
        }
      } catch (e) {
        console.warn("rag:proyecto-resolve error", e);
      }
    }

    const dominio = filters?.dominio && filters.dominio !== "todos" ? filters.dominio : null;
    const dominios: string[] | null = Array.isArray(filters?.dominios) && filters.dominios.length > 0
      ? filters.dominios.filter((d: any) => typeof d === "string" && d.length > 0)
      : null;
    const userId = claims.user.id;

    // Admin bypass: los admins ven TODO el conocimiento de la empresa (incluidos
    // chunks private de otros usuarios). Se detecta con user_roles vía service role.
    let isAdmin = false;
    try {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      isAdmin = (roles || []).some((r: any) => r.role === "admin");
    } catch (e) {
      console.warn("rag:admin-check failed", e);
    }
    console.log(`rag:visibility user=${userId} isAdmin=${isAdmin}`);

    // Para no-admins: filtro OR visibility. Para admins: sin filtro (ven todo).
    const visibilityOr = `visibility.in.(shared,global),owner_id.eq.${userId}`;
    const effectiveUserId = isAdmin ? null : userId;

    let contextChunks: any[] = [];
    const queryEmbedding = GOOGLE_AI_API_KEY
      ? await getQueryEmbedding(admin, question, GOOGLE_AI_API_KEY)
      : null;

    if (queryEmbedding) {
      const rpcArgs: Record<string, unknown> = {
        p_question: question,
        p_query_embedding: queryEmbedding as never,
        p_dominio: dominios ? null : dominio,
        p_proyecto_id: proyectoId || null,
        p_limit: 40,
        p_user_id: userId,
      };
      if (dominios) rpcArgs.p_dominios = dominios;
      console.time("rag:hybrid");
      const { data: hybrid, error: hybridErr } = await admin.rpc("rag_hybrid_search", rpcArgs as never);
      console.timeEnd("rag:hybrid");
      if (hybridErr) console.warn("rag:hybrid error", hybridErr.message);
      // Visibility ya viene filtrada en SQL (p_user_id). Mantenemos safety net.
      contextChunks = (hybrid || []).filter((c: any) =>
        c.owner_id === userId || ["shared", "global"].includes(c.visibility)
      );
      console.log(`rag:hybrid: ${hybrid?.length ?? 0} candidates (visibility-filtered in SQL) → ${contextChunks.length} final`);
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

    // Último fallback: si tenemos proyecto_id (por filtro o resuelto por nombre)
    // y aún no hay chunks, traer una muestra representativa del proyecto.
    if (contextChunks.length === 0 && proyectoId) {
      console.log(`rag:fallback-by-proyecto ${proyectoId}`);
      let fbp = admin
        .from("document_chunks")
        .select("id, contenido, chunk_index, metadata, documento_id, dominio")
        .eq("proyecto_id", proyectoId)
        .or(visibilityOr)
        .order("created_at", { ascending: false })
        .limit(20);
      if (dominios) fbp = fbp.in("dominio", dominios);
      else if (dominio) fbp = fbp.eq("dominio", dominio);
      const { data } = await fbp;
      contextChunks = data || [];
    }

    if (contextChunks.length === 0) {
      const noResultMsg = resolvedProyecto
        ? `No encontré chunks relevantes en el RAG para "${resolvedProyecto.nombre}" con esta consulta. Hay documentos indexados del proyecto pero ninguno coincide semánticamente — prueba a reformular la pregunta o sé más específico.`
        : "No se encontraron documentos relevantes. Asegúrate de haber subido e indexado documentos.";
      return new Response(JSON.stringify({
        answer: noResultMsg,
        citations: [],
        confidence: 0,
        resolved_proyecto: resolvedProyecto,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Rerank LLM sobre hasta 40 candidatos → top 8. Fallback: primeros 8 por hybrid_score.
    const rerankPool = contextChunks.slice(0, 40);
    let rerankLatency = 0;
    let rerankUsed = false;
    const rr = await rerankCandidates(question, rerankPool, LOVABLE_API_KEY);
    if (rr && rr.order.length > 0) {
      rerankUsed = true;
      rerankLatency = rr.latency_ms;
      const seen = new Set<number>();
      const reordered: any[] = [];
      for (const idx of rr.order) {
        if (!seen.has(idx) && rerankPool[idx]) { seen.add(idx); reordered.push(rerankPool[idx]); }
      }
      // Rellenar por hybrid_score si el reranker devolvió menos de 8
      for (let i = 0; i < rerankPool.length && reordered.length < 8; i++) {
        if (!seen.has(i)) reordered.push(rerankPool[i]);
      }
      contextChunks = reordered.slice(0, 8);
      admin.from("auditoria_ia").insert({
        funcion_ia: "rag-rerank",
        modelo: "google/gemini-2.5-flash",
        tokens_entrada: rr.tokens_in,
        tokens_salida: rr.tokens_out,
        latencia_ms: rr.latency_ms,
        exito: true,
        created_by: claims.user.id,
      }).then(({ error }: { error: unknown }) => { if (error) console.warn("rag:rerank audit", error); });
    } else {
      contextChunks = rerankPool.slice(0, 8);
    }
    console.log(`[phase-timing] rerank=${rerankLatency}ms used=${rerankUsed} candidates=${rerankPool.length}→${contextChunks.length}`);


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

    // Construir citas con documento_id — SOLO las que el modelo cita explícitamente.
    // Si no cita ninguna, devolvemos citations vacío para que el harness de grounding
    // pueda distinguir respuestas fundamentadas de las que no lo están.
    const citations = parsed.cited_sources
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
      resolved_proyecto: resolvedProyecto,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("rag-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
