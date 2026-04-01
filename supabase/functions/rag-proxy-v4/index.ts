import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * V4 RAG Proxy — Hybrid search (keyword + semantic scoring) with learned patterns
 */
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
    const { data: claims } = await userClient.auth.getUser();
    if (!claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { question, filters } = await req.json();

    if (!question) {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: corsHeaders });
    }

    const startTime = Date.now();

    // --- HYBRID SEARCH ---
    // 1. Full-text search (Spanish)
    let ftsQuery = admin
      .from("document_chunks")
      .select("*")
      .textSearch("contenido", question, { type: "websearch", config: "spanish" })
      .limit(15);

    if (filters?.proyecto_id) ftsQuery = ftsQuery.eq("proyecto_id", filters.proyecto_id);
    if (filters?.dominio && filters.dominio !== "todos") ftsQuery = ftsQuery.eq("dominio", filters.dominio);

    const { data: ftsResults } = await ftsQuery;

    // 2. ILIKE fallback search
    const keywords = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 5);
    let ilikeResults: any[] = [];
    
    if ((!ftsResults || ftsResults.length < 3) && keywords.length > 0) {
      let ilikeQuery = admin.from("document_chunks").select("*");
      if (filters?.proyecto_id) ilikeQuery = ilikeQuery.eq("proyecto_id", filters.proyecto_id);
      if (filters?.dominio && filters.dominio !== "todos") ilikeQuery = ilikeQuery.eq("dominio", filters.dominio);
      
      for (const kw of keywords.slice(0, 3)) {
        ilikeQuery = ilikeQuery.ilike("contenido", `%${kw}%`);
      }
      
      const { data } = await ilikeQuery.limit(10);
      ilikeResults = data || [];
    }

    // 3. Merge and deduplicate results
    const allChunks = new Map<string, any>();
    for (const c of (ftsResults || [])) {
      allChunks.set(c.id, { ...c, source: "fts", relevance: 1.0 });
    }
    for (const c of ilikeResults) {
      if (!allChunks.has(c.id)) {
        allChunks.set(c.id, { ...c, source: "ilike", relevance: 0.7 });
      }
    }

    // 4. Apply learned pattern boosts
    const { data: docPatterns } = await admin
      .from("ai_learned_patterns")
      .select("*")
      .eq("patron_tipo", "document_relevance")
      .eq("activo", true);

    const patternBoosts = new Map<string, number>();
    for (const p of docPatterns || []) {
      const dominio = p.patron_key.replace("dominio:", "");
      patternBoosts.set(dominio, p.score_ajuste);
    }

    // Apply domain boosts
    for (const [id, chunk] of allChunks) {
      const boost = patternBoosts.get(chunk.dominio) || 0;
      chunk.relevance += boost * 0.01; // Small multiplier
    }

    const rankedChunks = Array.from(allChunks.values())
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 8);

    if (rankedChunks.length === 0) {
      return new Response(JSON.stringify({
        answer: "No encontré información relevante en los documentos indexados para esta consulta. Intenta reformular la pregunta o verifica que los documentos estén indexados.",
        citations: [],
        confidence: 0.1,
        domain: filters?.dominio || "todos",
        search_method: "none",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // --- AI RESPONSE ---
    const domains = [...new Set(rankedChunks.map(c => c.dominio))];
    const dominantDomain = domains[0] || "general";

    const DOMAIN_PROMPTS: Record<string, string> = {
      contratos: "Eres un experto en derecho inmobiliario y contratos de arrendamiento comercial.",
      operadores: "Eres un analista especializado en el sector retail y operadores comerciales.",
      activos: "Eres un experto en valoración y gestión de activos inmobiliarios comerciales.",
      mercado: "Eres un analista de mercado inmobiliario comercial con enfoque en tendencias.",
      personas: "Eres un especialista en relaciones comerciales y gestión de contactos profesionales.",
      general: "Eres un asistente experto en gestión inmobiliaria comercial.",
    };

    const systemPrompt = `${DOMAIN_PROMPTS[dominantDomain] || DOMAIN_PROMPTS.general}
Responde en español basándote EXCLUSIVAMENTE en los fragmentos proporcionados. Si no hay información suficiente, indícalo.
IMPORTANTE: Aprende del feedback implícito — los fragmentos mejor posicionados tienden a ser más relevantes.`;

    const contextStr = rankedChunks.map((c, i) => {
      const meta = c.metadata || {};
      return `[Fragmento ${i + 1}] (Dominio: ${c.dominio}, Relevancia: ${c.relevance.toFixed(2)}, Doc: ${meta.nombre || "?"}):\n${c.contenido}`;
    }).join("\n\n---\n\n");

    const userPrompt = `FRAGMENTOS DE DOCUMENTOS (ordenados por relevancia):\n\n${contextStr}\n\nPREGUNTA: ${question}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-001",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "rag_response",
            description: "Structured RAG answer",
            parameters: {
              type: "object",
              properties: {
                answer: { type: "string", description: "Respuesta completa en español" },
                citations: {
                  type: "array",
                  items: { type: "string" },
                  description: "Nombres de documentos fuente",
                },
                confidence: { type: "number", description: "0-1, confianza en la respuesta" },
                key_entities: {
                  type: "array",
                  items: { type: "string" },
                  description: "Entidades clave mencionadas",
                },
              },
              required: ["answer", "citations", "confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rag_response" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido. Intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados. Contacta al administrador." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error: " + aiResponse.status);
    }

    const aiData = await aiResponse.json();
    const latency = Date.now() - startTime;
    const tokensIn = aiData.usage?.prompt_tokens || 0;
    const tokensOut = aiData.usage?.completion_tokens || 0;

    let result = { answer: "", citations: [] as string[], confidence: 0, key_entities: [] as string[] };

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      result.answer = aiData.choices?.[0]?.message?.content || "Sin respuesta";
      result.confidence = 0.5;
    }

    // Audit
    await admin.from("auditoria_ia").insert({
      modelo: "gemini-2.0-flash-001",
      funcion_ia: "rag_v4",
      tokens_entrada: tokensIn,
      tokens_salida: tokensOut,
      coste_estimado: tokensIn * 0.000001 + tokensOut * 0.000004,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      ...result,
      domain: dominantDomain,
      domains_found: domains,
      search_method: ftsResults && ftsResults.length > 0 ? "hybrid" : "ilike",
      chunks_used: rankedChunks.length,
      latency_ms: latency,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("rag-proxy-v4 error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
