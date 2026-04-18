import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Email Bulk Ingest
 * Recibe un lote de hilos de correo (ya parseados desde .mbox/.pst en el cliente o en otra capa)
 * y para cada hilo:
 *  - Crea documento_proyecto (visibility=private, owner=user)
 *  - Trocea contenido en document_chunks (private)
 *  - Llama a Gemini para extraer: resumen, entidades, señales
 *  - Inserta email_threads (shared), email_entities (shared), negotiation_signals (shared)
 *  - Upsert en contact_interactions (shared)
 *
 * Body esperado:
 * {
 *   threads: Array<{
 *     thread_external_id?: string,
 *     subject: string,
 *     participants: Array<{email: string, name?: string, role?: 'from'|'to'|'cc'}>,
 *     messages: Array<{ from: string, to: string[], date: string, body: string }>,
 *     attachments?: Array<{ filename: string, mime: string, size: number }>
 *   }>,
 *   visibility_raw?: 'private' | 'shared',     // por defecto private
 *   visibility_intel?: 'shared' | 'private',   // por defecto shared
 *   share_extraction?: boolean                 // si false, no crea email_threads/entidades
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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
    const userId = claims.user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const threads = Array.isArray(body?.threads) ? body.threads : [];
    if (threads.length === 0) {
      return new Response(JSON.stringify({ error: "threads required (array)" }), { status: 400, headers: corsHeaders });
    }
    if (threads.length > 50) {
      return new Response(JSON.stringify({ error: "max 50 threads per batch" }), { status: 400, headers: corsHeaders });
    }

    const visibilityRaw = body?.visibility_raw || "private";
    const visibilityIntel = body?.visibility_intel || "shared";
    const shareExtraction = body?.share_extraction !== false;

    const startTime = Date.now();
    const results: any[] = [];

    for (const thread of threads) {
      try {
        const result = await processThread({
          thread,
          userId,
          admin,
          lovableKey: LOVABLE_API_KEY,
          visibilityRaw,
          visibilityIntel,
          shareExtraction,
        });
        results.push(result);
      } catch (e) {
        console.error("Thread processing error:", e);
        results.push({ ok: false, error: e instanceof Error ? e.message : String(e), subject: thread?.subject });
      }
    }

    const latency = Date.now() - startTime;
    const okCount = results.filter((r) => r.ok).length;

    // Audit
    await admin.from("auditoria_ia").insert({
      modelo: "gemini-2.5-flash",
      funcion_ia: "email_bulk_ingest",
      tokens_entrada: results.reduce((s, r) => s + (r.tokens_in || 0), 0),
      tokens_salida: results.reduce((s, r) => s + (r.tokens_out || 0), 0),
      coste_estimado: results.reduce((s, r) => s + (r.cost || 0), 0),
      latencia_ms: latency,
      exito: okCount > 0,
      created_by: userId,
    });

    return new Response(JSON.stringify({
      ok: true,
      processed: results.length,
      successful: okCount,
      failed: results.length - okCount,
      latency_ms: latency,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("email-bulk-ingest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processThread(opts: {
  thread: any;
  userId: string;
  admin: any;
  lovableKey: string;
  visibilityRaw: string;
  visibilityIntel: string;
  shareExtraction: boolean;
}) {
  const { thread, userId, admin, lovableKey, visibilityRaw, visibilityIntel, shareExtraction } = opts;

  const subject = thread.subject || "(sin asunto)";
  const participants = thread.participants || [];
  const messages = thread.messages || [];
  const fullText = messages.map((m: any) =>
    `From: ${m.from}\nTo: ${(m.to || []).join(", ")}\nDate: ${m.date}\n\n${m.body || ""}`
  ).join("\n\n---\n\n");

  const dates = messages.map((m: any) => new Date(m.date).getTime()).filter((t: number) => !isNaN(t));
  const firstDate = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
  const lastDate = dates.length ? new Date(Math.max(...dates)).toISOString() : null;

  // 1. Documento (raw, private)
  const { data: doc, error: docErr } = await admin.from("documentos_proyecto").insert({
    nombre: `[Email] ${subject}`.slice(0, 200),
    storage_path: `emails/${userId}/${crypto.randomUUID()}.txt`,
    mime_type: "text/plain",
    tamano_bytes: fullText.length,
    tipo_documento: "email",
    owner_id: userId,
    subido_por: userId,
    visibility: visibilityRaw,
    procesado_ia: true,
    metadata_extraida: {
      subject,
      participants,
      message_count: messages.length,
      first_date: firstDate,
      last_date: lastDate,
    },
  }).select().single();

  if (docErr) throw new Error(`doc insert: ${docErr.message}`);

  // 2. Chunks raw (private)
  const chunks = chunkText(fullText, 1500);
  if (chunks.length > 0) {
    const chunkRows = chunks.map((c, i) => ({
      documento_id: doc.id,
      chunk_index: i,
      contenido: c,
      dominio: "emails",
      owner_id: userId,
      visibility: visibilityRaw,
      metadata: { subject, source: "email", thread_external_id: thread.thread_external_id || null },
    }));
    await admin.from("document_chunks").insert(chunkRows);
  }

  if (!shareExtraction) {
    return { ok: true, subject, doc_id: doc.id, chunks: chunks.length, extracted: false };
  }

  // 3. Extracción IA estructurada
  const extraction = await extractKnowledge(fullText.slice(0, 8000), subject, participants, lovableKey);

  // 4. email_threads (shared)
  const { data: emailThread, error: threadErr } = await admin.from("email_threads").insert({
    owner_id: userId,
    visibility: visibilityIntel,
    thread_external_id: thread.thread_external_id || null,
    subject,
    participants,
    first_date: firstDate,
    last_date: lastDate,
    message_count: messages.length,
    summary: extraction.summary,
    key_topics: extraction.key_topics || [],
    sentiment: extraction.sentiment,
    documento_id: doc.id,
    metadata: { attachments: thread.attachments || [] },
  }).select().single();

  if (threadErr) throw new Error(`thread insert: ${threadErr.message}`);

  // 5. email_entities
  const entities = extraction.entities || [];
  if (entities.length > 0) {
    const entityRows = entities.map((e: any) => ({
      thread_id: emailThread.id,
      owner_id: userId,
      visibility: visibilityIntel,
      entity_type: e.type,
      entity_name_raw: e.name,
      mention_count: e.mention_count || 1,
      confidence: e.confidence ?? 0.6,
      context_snippet: (e.context || "").slice(0, 240),
    }));
    await admin.from("email_entities").insert(entityRows);
  }

  // 6. negotiation_signals
  const signals = extraction.signals || [];
  if (signals.length > 0) {
    const signalRows = signals.map((s: any) => ({
      thread_id: emailThread.id,
      owner_id: userId,
      visibility: visibilityIntel,
      signal_type: s.type,
      signal_value: s.value ? String(s.value) : null,
      numeric_value: typeof s.numeric_value === "number" ? s.numeric_value : null,
      unit: s.unit || null,
      context_snippet: (s.context || "").slice(0, 240),
      confidence: s.confidence ?? 0.6,
    }));
    await admin.from("negotiation_signals").insert(signalRows);
  }

  // 7. contact_interactions (upsert por (owner_id, contact_email))
  const externalContacts = participants.filter((p: any) => p.email);
  for (const p of externalContacts) {
    const email = String(p.email).toLowerCase();
    const { data: existing } = await admin
      .from("contact_interactions")
      .select("id, thread_count, message_count, first_interaction, last_interaction, topics")
      .eq("owner_id", userId)
      .eq("contact_email", email)
      .maybeSingle();

    if (existing) {
      const newTopics = Array.from(new Set([...(existing.topics || []), ...(extraction.key_topics || [])])).slice(0, 20);
      await admin.from("contact_interactions").update({
        thread_count: (existing.thread_count || 0) + 1,
        message_count: (existing.message_count || 0) + messages.length,
        first_interaction: firstDate && (!existing.first_interaction || firstDate < existing.first_interaction)
          ? firstDate : existing.first_interaction,
        last_interaction: lastDate && (!existing.last_interaction || lastDate > existing.last_interaction)
          ? lastDate : existing.last_interaction,
        topics: newTopics,
      }).eq("id", existing.id);
    } else {
      await admin.from("contact_interactions").insert({
        owner_id: userId,
        visibility: visibilityIntel,
        contact_email: email,
        contact_name: p.name || null,
        thread_count: 1,
        message_count: messages.length,
        first_interaction: firstDate,
        last_interaction: lastDate,
        topics: (extraction.key_topics || []).slice(0, 10),
      });
    }
  }

  return {
    ok: true,
    subject,
    doc_id: doc.id,
    thread_id: emailThread.id,
    chunks: chunks.length,
    entities: entities.length,
    signals: signals.length,
    tokens_in: extraction.tokens_in,
    tokens_out: extraction.tokens_out,
    cost: extraction.cost,
  };
}

function chunkText(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + maxLen));
    i += maxLen;
  }
  return chunks;
}

async function extractKnowledge(text: string, subject: string, participants: any[], apiKey: string) {
  const systemPrompt = `Eres un analista experto en negociaciones inmobiliarias comerciales. Extraes conocimiento estructurado de hilos de correo electrónico para alimentar un grafo de inteligencia compartida.
NO incluyas texto literal del correo en los snippets de contexto: usa máximo 1 frase resumida y neutra.
Idioma: responde siempre en español.`;

  const userPrompt = `ASUNTO: ${subject}
PARTICIPANTES: ${participants.map((p: any) => `${p.name || ""} <${p.email}>`).join(", ")}

CONTENIDO DEL HILO:
${text}

Extrae: resumen ejecutivo (3-5 líneas), temas clave, entidades mencionadas (operadores/marcas, contactos, activos/locales, proyectos), señales de negociación (precio, superficie, plazos, condiciones), y sentimiento general.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "extract_email_intelligence",
          description: "Extrae conocimiento estructurado de un hilo de correo",
          parameters: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Resumen ejecutivo neutro 3-5 líneas" },
              key_topics: { type: "array", items: { type: "string" }, description: "Temas clave (máx 8)" },
              sentiment: { type: "string", enum: ["positivo", "neutro", "negativo", "tenso"] },
              entities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["operador", "contacto", "activo", "proyecto"] },
                    name: { type: "string" },
                    mention_count: { type: "number" },
                    confidence: { type: "number" },
                    context: { type: "string", description: "1 frase resumida, no literal" },
                  },
                  required: ["type", "name"],
                },
              },
              signals: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    type: { type: "string", enum: ["precio", "superficie", "plazo", "condicion", "deadline", "objecion", "interes", "rechazo"] },
                    value: { type: "string" },
                    numeric_value: { type: "number" },
                    unit: { type: "string" },
                    context: { type: "string", description: "1 frase resumida, no literal" },
                    confidence: { type: "number" },
                  },
                  required: ["type"],
                },
              },
            },
            required: ["summary", "key_topics", "entities", "signals"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "extract_email_intelligence" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI gateway ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const tokensIn = data.usage?.prompt_tokens || 0;
  const tokensOut = data.usage?.completion_tokens || 0;
  const cost = tokensIn * 0.0000003 + tokensOut * 0.0000025;

  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    return { summary: "", key_topics: [], entities: [], signals: [], sentiment: "neutro", tokens_in: tokensIn, tokens_out: tokensOut, cost };
  }
  const parsed = JSON.parse(toolCall.function.arguments);
  return { ...parsed, tokens_in: tokensIn, tokens_out: tokensOut, cost };
}
