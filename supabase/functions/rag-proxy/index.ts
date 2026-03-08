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

    // Full-text search for relevant chunks
    // We use a raw SQL query via RPC or direct query
    let query = admin
      .from("document_chunks")
      .select("id, contenido, chunk_index, metadata, documento_id")
      .textSearch("contenido", question, { type: "websearch", config: "spanish" })
      .limit(10);

    if (proyectoId) {
      query = query.eq("proyecto_id", proyectoId);
    }

    const { data: chunks, error: searchErr } = await query;

    // Fallback: if FTS returns nothing, try ILIKE on key terms
    let contextChunks = chunks || [];
    if (contextChunks.length === 0) {
      const words = question.split(/\s+/).filter((w: string) => w.length > 3).slice(0, 3);
      if (words.length > 0) {
        let fallback = admin
          .from("document_chunks")
          .select("id, contenido, chunk_index, metadata, documento_id")
          .limit(10);

        if (proyectoId) fallback = fallback.eq("proyecto_id", proyectoId);
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
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build context for AI
    const context = contextChunks.map((c: any, i: number) => {
      const docName = c.metadata?.nombre || "Documento";
      return `[Fuente ${i + 1}: "${docName}", fragmento ${c.chunk_index}]\n${c.contenido}`;
    }).join("\n\n---\n\n");

    const systemPrompt = `Eres un asistente experto en el sector inmobiliario comercial (retail real estate). 
Responde SIEMPRE en español. Basa tu respuesta ÚNICAMENTE en los fragmentos de documentos proporcionados.
Si la información no está en los documentos, dilo claramente.
Al final de tu respuesta, lista las fuentes que utilizaste en formato: [Fuente X: "nombre_doc", fragmento N].
Sé conciso, profesional y preciso.`;

    const userPrompt = `CONTEXTO DE DOCUMENTOS DEL PROYECTO:

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
        model: "google/gemini-3-flash-preview",
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
                  description: "List of source references used, e.g. 'Documento X, fragmento N'",
                },
                confidence: {
                  type: "number",
                  description: "Confidence score 0-1 based on how well the documents answer the question",
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
      const body = await aiResp.text();
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
      // Fallback: use message content
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
      funcion_ia: "rag-proxy",
      modelo: "google/gemini-3-flash-preview",
      tokens_entrada: aiData.usage?.prompt_tokens || 0,
      tokens_salida: aiData.usage?.completion_tokens || 0,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rag-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
