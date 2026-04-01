import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DOMAIN_SYSTEM_PROMPTS: Record<string, string> = {
  contratos: `Eres un experto legal en contratos de arrendamiento inmobiliario comercial. Analiza clausulado, condiciones, precios y plazos con precisión jurídica.`,
  operadores: `Eres un analista especializado en operadores retail. Conoces perfiles de expansión, criterios de búsqueda, rangos de precio y patrones de negociación.`,
  activos: `Eres un experto en activos inmobiliarios comerciales. Valoras locales, centros comerciales, analizas métricas de superficie, precio/m² y benchmarks de mercado.`,
  mercado: `Eres un analista de mercado inmobiliario retail. Interpretas informes sectoriales, tendencias, datos demográficos y señales de mercado.`,
  personas: `Eres un experto en inteligencia relacional y perfiles de negociación. Analizas estilos comunicativos, preferencias y patrones de decisión.`,
  general: `Eres un asistente experto en el sector inmobiliario comercial (retail real estate).`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

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

    const { question, filters } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "question required" }), { status: 400, headers: corsHeaders });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const proyectoId = filters?.proyecto_id;
    const dominio = filters?.dominio; // Optional: filter by specific domain

    // Full-text search for relevant chunks
    let query = admin
      .from("document_chunks")
      .select("id, contenido, chunk_index, metadata, documento_id, dominio")
      .textSearch("contenido", question, { type: "websearch", config: "spanish" })
      .limit(10);

    if (proyectoId) query = query.eq("proyecto_id", proyectoId);
    if (dominio && dominio !== "todos") query = query.eq("dominio", dominio);

    const { data: chunks } = await query;

    // Fallback: ILIKE
    let contextChunks = chunks || [];
    if (contextChunks.length === 0) {
      const words = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
      if (words.length > 0) {
        let fallback = admin
          .from("document_chunks")
          .select("id, contenido, chunk_index, metadata, documento_id, dominio")
          .limit(10);

        if (proyectoId) fallback = fallback.eq("proyecto_id", proyectoId);
        if (dominio && dominio !== "todos") fallback = fallback.eq("dominio", dominio);
        fallback = fallback.ilike("contenido", `%${words[0]}%`);

        const { data: fbData } = await fallback;
        contextChunks = fbData || [];
      }
    }

    if (contextChunks.length === 0) {
      return new Response(JSON.stringify({
        answer: "No se encontraron documentos relevantes para responder esta pregunta. Asegúrate de haber subido e indexado documentos en el proyecto.",
        citations: [],
        confidence: 0,
        domains_searched: dominio || "todos",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Determine dominant domain for specialized system prompt
    const domainCounts: Record<string, number> = {};
    for (const c of contextChunks) {
      const d = (c as any).dominio || "general";
      domainCounts[d] = (domainCounts[d] || 0) + 1;
    }
    const dominantDomain = Object.entries(domainCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "general";
    const domainSystemPrompt = DOMAIN_SYSTEM_PROMPTS[dominantDomain] || DOMAIN_SYSTEM_PROMPTS.general;

    // Build context
    const context = contextChunks.map((c: any, i: number) => {
      const docName = c.metadata?.nombre || "Documento";
      const dom = c.dominio || "general";
      return `[Fuente ${i + 1}: "${docName}", dominio: ${dom}, fragmento ${c.chunk_index}]\n${c.contenido}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `${domainSystemPrompt}
Responde SIEMPRE en español. Basa tu respuesta ÚNICAMENTE en los fragmentos de documentos proporcionados.
Si la información no está en los documentos, dilo claramente.
Al final de tu respuesta, lista las fuentes que utilizaste en formato: [Fuente X: "nombre_doc", fragmento N].
Sé conciso, profesional y preciso.`;

    const userPrompt = `CONTEXTO DE DOCUMENTOS (dominio principal: ${dominantDomain}):

${context}

---

PREGUNTA DEL USUARIO: ${question}

Responde basándote en los documentos anteriores. Cita las fuentes utilizadas.`;

    const startMs = Date.now();
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            description: "Structured RAG response with answer, citations, and confidence",
            parameters: {
              type: "object",
              properties: {
                answer: { type: "string", description: "The answer in Spanish based on the documents" },
                citations: {
                  type: "array",
                  items: { type: "string" },
                  description: "List of source references used",
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-1",
                },
              },
              required: ["answer", "citations", "confidence"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "rag_response" } },
      }),
    });

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, inténtalo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const body = await aiResp.text();
      console.error("AI error:", status, body);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const latency = Date.now() - startMs;

    let result: { answer: string; citations: string[]; confidence: number };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const args = typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
      result = args;
    } else {
      result = {
        answer: aiData.choices?.[0]?.message?.content || "No se pudo generar una respuesta.",
        citations: contextChunks.map((c: any) => c.metadata?.nombre || "Documento").filter(
          (v: string, i: number, a: string[]) => a.indexOf(v) === i
        ),
        confidence: 0.5,
      };
    }

    // Audit
    await admin.from("auditoria_ia").insert({
      funcion_ia: `rag-proxy:${dominantDomain}`,
      modelo: "google/gemini-3-flash-preview",
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      ...result,
      domain: dominantDomain,
      domains_found: Object.keys(domainCounts),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rag-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
