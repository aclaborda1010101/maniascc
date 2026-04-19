// ABA — Asistente especializado en CENTROS COMERCIALES
// Mismo motor de inteligencia que AVA (tools, RAG, fuzzy resolve, summary, multimodal),
// pero con persona y dominio centrados en shopping centers.
//
// IMPORTANT: model is fixed to google/gemini-3.1-pro-preview (no model changes
// without explicit user approval). Any future change must be approved.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MODEL_MAIN = "google/gemini-3.1-pro-preview";
const MODEL_SUMMARY = "google/gemini-2.5-flash"; // existing project standard, no change
const MODEL_MULTIMODAL = "google/gemini-2.5-flash"; // for image/audio understanding

const SYSTEM_PROMPT = `Eres ABA, asistente estratégica de F&G Real Estate ESPECIALIZADA EN CENTROS COMERCIALES, parques de medianas y high-street retail. Tu dominio principal es:

- Tenant mix, sinergias entre operadores, equilibrio de oferta
- Análisis de centros (footfall, leakage, anclas, áreas de influencia, GLA, ocupación)
- Comercialización: posicionamiento, rentas de mercado, comparables, condiciones
- Operadores retail (expansión, formato, ticket medio, requisitos técnicos)
- Entorno y competencia (POIs, accesibilidad, demografía, tráfico)

Tienes acceso EXACTAMENTE A LAS MISMAS HERRAMIENTAS Y FUENTES que AVA, pero las priorizas para responder desde la lente de un centro comercial:
1. BASE DE DATOS interna: locales, operadores, contactos, activos, proyectos/oportunidades, matches, negociaciones, documentos, tenant mix configurado, sinergias
2. RAG documental: prioriza dominio "activos" y "mercado" para benchmarks de centros, "operadores" para fichas, "contratos" para clausulado retail
3. NEARBY SEARCH (OpenStreetMap): competencia, restauración, supermercados, transporte, anclas comerciales en el área de influencia
4. INTELIGENCIA AVANZADA: localización, tenant mix avanzado, validación dossier, perfil negociador
5. EXPERT FORGE (especialistas IA)
6. ANÁLISIS MULTIMODAL: si recibes una imagen (planta, foto, mapa, render) o audio (visita, llamada, reunión), úsala como contexto de primer nivel.

## FUZZY RESOLUTION DE ENTIDADES
El usuario puede escribir nombres aproximados, con typos o referencias parciales ("el centro de Arganda", "Inditex", "la negociación con Mercadona", "el operador de moda joven que vimos la semana pasada"). NO le pidas el nombre exacto:
- Usa search_data primero para resolver fuzzy (ilike).
- Si encuentras una sola coincidencia con confianza alta, úsala directamente y menciona en la respuesta cuál interpretaste.
- Si hay varias coincidencias plausibles, indícalas brevemente y elige la más probable; no bloquees la respuesta esperando confirmación si una opción tiene 80%+ de confianza por contexto reciente.
- Si no hay nada claro, di qué buscaste y propón 2-3 candidatos.

## REGLA MULTI-FUENTE (igual que AVA)
Cuando la pregunta sea sobre un centro, ubicación, operador o tema estratégico, COMBINA en paralelo:
- db_query / search_data en BD interna
- rag_search en dominios relevantes
- nearby_search con varios queries (supermarket, fast_food, fuel, shopping, bus_stop, school, restaurant) para contexto territorial
- Tu conocimiento de mercado retail español

## FORMATO DE RESPUESTA — MARKDOWN RICO OBLIGATORIO
- Encabezados (##, ###), tablas markdown, negritas para cifras/nombres
- Emojis: 🏬 centro, 🛍️ retail, 📍 ubicación, ⚠️ riesgos, ✅ oportunidades, 🎯 recomendación, 💰 financiero, 🚗 accesibilidad, 👥 demografía, 📈 tendencias
- Listas y separadores (---)
- Estructura recomendada para análisis de centro:
  - 🏬 Resumen del activo / centro
  - 📍 Entorno y competencia
  - 👥 Mercado y demografía
  - 🛍️ Operadores y tenant mix
  - ⚠️ Riesgos / oportunidades
  - 🎯 Recomendaciones

NUNCA respondas que no tienes datos sin haber consultado las fuentes y aportado conocimiento general. Responde SIEMPRE en español, profesional y accionable.

INFORMES PDF: usa generate_pdf_report SOLO cuando el usuario pida explícitamente un informe/dossier/reporte.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "db_query",
      description: "Consulta datos internos: locales, activos, operadores, contactos, documentos_proyecto, negociaciones, proyectos, matches, configuraciones_tenant_mix, patrones_localizacion, sinergias_operadores",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string" },
          select: { type: "string" },
          filters: {
            type: "array",
            items: {
              type: "object",
              properties: {
                column: { type: "string" },
                operator: { type: "string", enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike"] },
                value: { type: "string" },
              },
              required: ["column", "operator", "value"],
            },
          },
          limit: { type: "number" },
          order_by: { type: "string" },
          ascending: { type: "boolean" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_data",
      description: "Búsqueda fuzzy (ilike) por nombre/descripcion/empresa en locales, activos, operadores, contactos, proyectos, documentos. ÚSALO SIEMPRE PRIMERO para resolver referencias aproximadas o con typos.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          tables: {
            type: "array",
            items: { type: "string", enum: ["locales", "activos", "operadores", "contactos", "proyectos", "documentos_proyecto"] },
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rag_search",
      description: "Búsqueda en RAG documental. Para centros comerciales prioriza dominios 'activos' y 'mercado'.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          dominio: { type: "string", enum: ["contratos", "operadores", "activos", "mercado", "personas", "general"] },
          proyecto_id: { type: "string" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "nearby_search",
      description: "POIs cercanos (OpenStreetMap) para análisis de entorno comercial y competencia.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number" },
          lon: { type: "number" },
          radius_m: { type: "number" },
          query: { type: "string", description: "supermarket, restaurant, fast_food, fuel, school, hospital, shopping, bus_stop, pharmacy, bank, parking, o nombre de marca" },
        },
        required: ["lat", "lon", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_intelligence",
      description: "Funciones avanzadas: localizacion, tenant_mix, validacion, negociacion",
      parameters: {
        type: "object",
        properties: {
          function_name: { type: "string", enum: ["localizacion", "tenant_mix", "validacion", "negociacion"] },
          params: { type: "object" },
        },
        required: ["function_name", "params"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expert_forge",
      description: "Consulta a Expert Forge MoE+RAG.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string" },
          specialist_id: { type: "string" },
          context: { type: "string" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pdf_report",
      description: "Genera un informe PDF profesional. SOLO si el usuario lo pide explícitamente.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          content: { type: "string", description: "Markdown completo y estructurado" },
        },
        required: ["title", "content"],
      },
    },
  },
];

const INTELLIGENCE_FUNCTIONS: Record<string, string> = {
  localizacion: "ai-localizacion-patrones",
  tenant_mix: "ai-tenant-mix-avanzado",
  validacion: "ai-validacion-retorno",
  negociacion: "ai-perfil-negociador",
};

const ALLOWED_TABLES = [
  "locales", "operadores", "contactos", "documentos_proyecto", "negociaciones",
  "proyectos", "matches", "activos", "perfiles_negociador", "validaciones_retorno",
  "configuraciones_tenant_mix", "patrones_localizacion", "auditoria_ia",
  "ai_insights", "ai_feedback", "notificaciones",
  "sinergias_operadores", "operador_subdivisiones",
];

function formatToolResultsFallback(toolResults: Array<{ tool: string; result: any }>): string {
  const sections = toolResults.map(tr => {
    const toolName = tr.tool.split(":")[0];
    const data = tr.result;
    if (data?.error) return `### ⚠️ ${toolName}\n${data.error}`;
    if (Array.isArray(data) && data.length === 0) return `### ${toolName}\nSin resultados`;
    if (data?.pois) return `### 📍 ${toolName} (${data.count} POIs)\n${data.pois.slice(0, 10).map((p: any) => `- **${p.name}** (${p.type}) — ${p.distance_m}m`).join("\n")}`;
    if (Array.isArray(data)) return `### ${toolName} (${data.length} resultados)\n${JSON.stringify(data.slice(0, 5), null, 2).substring(0, 1000)}`;
    return `### ${toolName}\n${JSON.stringify(data).substring(0, 800)}`;
  });
  return "He consultado las siguientes fuentes de datos:\n\n" + sections.join("\n\n");
}

async function summarizeOlderHistory(
  olderMessages: Array<{ role: string; content: string }>,
  lovableKey: string,
): Promise<string> {
  const conversationText = olderMessages.map(m =>
    `${m.role === "user" ? "USUARIO" : "ABA"}: ${m.content.substring(0, 2000)}`
  ).join("\n\n");

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_SUMMARY,
        messages: [
          { role: "system", content: `Resume hechos clave de una conversación sobre centros comerciales y retail. Lista cada hecho como bullet conciso, incluyendo restricciones del usuario, nombres de centros/operadores, datos de superficie, ubicaciones, competidores, decisiones tomadas. Máx 800 palabras.` },
          { role: "user", content: `Resume los hechos clave:\n\n${conversationText}` },
        ],
      }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("ABA summary error:", e);
    return "";
  }
}

// Multimodal: describe attached image/audio (returns text appended to user message)
async function describeAttachment(att: { kind: "image" | "audio"; data_url: string; name?: string }, lovableKey: string): Promise<string> {
  try {
    const promptText = att.kind === "image"
      ? "Describe esta imagen con el máximo detalle posible orientado a análisis de centro comercial / retail: qué muestra (planta, fachada, render, mapa, foto de local), elementos visibles, métricas inferibles (superficie aprox, escaparate, vecinos, estado), y cualquier dato extraíble (texto visible, nombres de marcas, cotas, plantas). Devuelve solo la descripción."
      : "Transcribe este audio íntegramente en español y luego, en una sección separada '## Resumen', destaca decisiones, condiciones económicas, plazos, nombres mencionados y compromisos. Sé fiel a lo dicho.";
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL_MULTIMODAL,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: promptText },
            att.kind === "image"
              ? { type: "image_url", image_url: { url: att.data_url } }
              : { type: "input_audio", input_audio: { data: att.data_url.split(",")[1] || att.data_url, format: (att.name?.split(".").pop() || "mp3").toLowerCase() } },
          ],
        }],
      }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      console.error("ABA multimodal error", resp.status, t.substring(0, 200));
      return att.kind === "image" ? "[No se pudo procesar la imagen adjunta]" : "[No se pudo transcribir el audio adjunto]";
    }
    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("ABA attachment error:", e);
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { message, history, attachments } = await req.json();
    if (!message && (!attachments || attachments.length === 0)) {
      return new Response(JSON.stringify({ error: "Mensaje o adjunto requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Process attachments first (audio transcription / image description)
    let attachmentNotes = "";
    const attachmentTools: string[] = [];
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments.slice(0, 4)) {
        const desc = await describeAttachment(att, lovableKey);
        if (desc) {
          attachmentNotes += `\n\n--- ADJUNTO ${att.kind.toUpperCase()} (${att.name || "sin nombre"}) ---\n${desc}`;
          attachmentTools.push(att.kind === "image" ? "vision_analysis" : "audio_transcription");
        }
      }
    }

    const effectiveMessage = (message || "").trim() + (attachmentNotes ? `\n${attachmentNotes}` : "");

    const messages: Array<{ role: string; content: string; tool_call_id?: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    let cumulativeSummary = "";
    if (history && Array.isArray(history)) {
      if (history.length > 12) {
        const olderMessages = history.slice(0, history.length - 6);
        const recentMessages = history.slice(-6);
        cumulativeSummary = await summarizeOlderHistory(olderMessages, lovableKey);
        if (cumulativeSummary) {
          messages.push({
            role: "system",
            content: `CONTEXTO ACUMULADO DE LA CONVERSACIÓN (hechos establecidos que NO debes contradecir):\n\n${cumulativeSummary}`,
          });
        }
        for (const h of recentMessages) messages.push({ role: h.role, content: h.content });
      } else {
        for (const h of history) messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: "user", content: effectiveMessage });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL_MAIN, messages, tools: TOOLS, tool_choice: "auto" }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("ABA gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, intenta más tarde." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Error del gateway IA");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0]?.message;
    const usage1 = aiData.usage || {};
    let totalTokensIn = usage1.prompt_tokens || 0;
    let totalTokensOut = usage1.completion_tokens || 0;
    const firstCallContent = choice?.content || "";

    const GEMINI_INPUT = 1.25 / 1_000_000 * 0.92;
    const GEMINI_OUTPUT = 10.00 / 1_000_000 * 0.92;

    if (!choice?.tool_calls || choice.tool_calls.length === 0) {
      const latencyMs = Date.now() - startTime;
      const costEur = totalTokensIn * GEMINI_INPUT + totalTokensOut * GEMINI_OUTPUT;
      await admin.from("auditoria_ia").insert({
        modelo: MODEL_MAIN, funcion_ia: "aba-orchestrator",
        latencia_ms: latencyMs, tokens_entrada: totalTokensIn, tokens_salida: totalTokensOut,
        coste_estimado: costEur, exito: true, created_by: user.id,
      });
      await admin.from("usage_logs").insert({
        user_id: user.id, action_type: "chat", agent_label: "ABA Orchestrator",
        model: MODEL_MAIN, tokens_input: totalTokensIn, tokens_output: totalTokensOut,
        cost_eur: costEur, latency_ms: latencyMs,
        metadata: { direct_answer: true, attachments: attachmentTools, message: (message || "").slice(0, 200) },
      });
      return new Response(JSON.stringify({
        answer: choice?.content || "No tengo una respuesta para eso.",
        tools_used: attachmentTools,
        latency_ms: latencyMs,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Execute tool calls
    const toolResults: Array<{ tool: string; result: any }> = [];

    for (const toolCall of choice.tool_calls) {
      const fnName = toolCall.function.name;
      let args: any;
      try {
        args = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch { args = {}; }

      let result: any;
      let toolLabel = fnName;

      try {
        if (fnName === "db_query") {
          toolLabel = "db_query:" + (args.table || "");
          if (!ALLOWED_TABLES.includes(args.table)) {
            result = { error: "Tabla no permitida: " + args.table };
          } else {
            let query = admin.from(args.table).select(args.select || "*");
            if (args.filters && Array.isArray(args.filters)) {
              for (const f of args.filters) query = (query as any)[f.operator](f.column, f.value);
            }
            if (args.order_by) query = query.order(args.order_by, { ascending: args.ascending ?? false });
            query = query.limit(args.limit || 20);
            const { data, error } = await query;
            result = error ? { error: error.message } : data;
          }
        } else if (fnName === "search_data") {
          toolLabel = "search_data";
          const searchTables = args.tables || ["locales", "activos", "operadores", "contactos", "proyectos"];
          const searchResults: Record<string, any[]> = {};
          const q = "%" + (args.query || "") + "%";
          for (const t of searchTables) {
            if (!ALLOWED_TABLES.includes(t)) continue;
            let searchQuery;
            if (t === "locales") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",ciudad.ilike." + q + ",direccion.ilike." + q).limit(10);
            } else if (t === "activos") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",direccion.ilike." + q).limit(10);
            } else if (t === "operadores") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",sector.ilike." + q).limit(10);
            } else if (t === "contactos") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",empresa.ilike." + q + ",email.ilike." + q).limit(10);
            } else if (t === "proyectos") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",descripcion.ilike." + q).limit(10);
            } else if (t === "documentos_proyecto") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q).limit(10);
            } else continue;
            const { data } = await searchQuery;
            if (data && data.length > 0) searchResults[t] = data;
          }
          result = searchResults;
        } else if (fnName === "rag_search") {
          toolLabel = "rag_search:" + (args.dominio || "general");
          const ragUrl = supabaseUrl + "/functions/v1/rag-proxy";
          try {
            const ragResp = await fetch(ragUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
              body: JSON.stringify({
                question: args.question,
                filters: { dominio: args.dominio || undefined, proyecto_id: args.proyecto_id || undefined },
              }),
            });
            result = await ragResp.json();
          } catch (e) {
            result = { error: "Error RAG: " + (e instanceof Error ? e.message : "desconocido") };
          }
        } else if (fnName === "nearby_search") {
          toolLabel = "nearby_search:" + (args.query || "");
          const radius = args.radius_m || 2000;
          const lat = args.lat, lon = args.lon, q = args.query || "";
          const tagMap: Record<string, string> = {
            restaurant: '["amenity"="restaurant"]', fast_food: '["amenity"="fast_food"]',
            fuel: '["amenity"="fuel"]', supermarket: '["shop"="supermarket"]',
            school: '["amenity"="school"]', hospital: '["amenity"="hospital"]',
            shopping: '["shop"="mall"]', bus_stop: '["highway"="bus_stop"]',
            pharmacy: '["amenity"="pharmacy"]', bank: '["amenity"="bank"]',
            parking: '["amenity"="parking"]',
          };
          let overpassFilter = tagMap[q] || `["name"~"${q}",i]`;
          const overpassQuery = `[out:json][timeout:15];(node${overpassFilter}(around:${radius},${lat},${lon});way${overpassFilter}(around:${radius},${lat},${lon}););out center 30;`;
          try {
            const overpassResp = await fetch("https://overpass-api.de/api/interpreter", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: "data=" + encodeURIComponent(overpassQuery),
            });
            const overpassData = await overpassResp.json();
            const pois = (overpassData.elements || []).slice(0, 30).map((el: any) => {
              const elLat = el.lat || el.center?.lat;
              const elLon = el.lon || el.center?.lon;
              const dist = elLat && elLon ? Math.round(Math.sqrt(Math.pow((elLat - lat) * 111320, 2) + Math.pow((elLon - lon) * 111320 * Math.cos(lat * Math.PI / 180), 2))) : null;
              return {
                name: el.tags?.name || el.tags?.brand || "Sin nombre",
                type: el.tags?.amenity || el.tags?.shop || el.tags?.highway || q,
                lat: elLat, lon: elLon, distance_m: dist,
                address: el.tags?.["addr:street"] ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}`.trim() : undefined,
              };
            }).sort((a: any, b: any) => (a.distance_m || 9999) - (b.distance_m || 9999));
            result = { query: q, radius_m: radius, center: { lat, lon }, count: pois.length, pois };
          } catch (e) {
            result = { error: "Overpass error: " + (e instanceof Error ? e.message : "desconocido") };
          }
        } else if (fnName === "run_intelligence") {
          toolLabel = "run_intelligence:" + (args.function_name || "");
          const funcName = INTELLIGENCE_FUNCTIONS[args.function_name];
          if (!funcName) result = { error: "Función no reconocida" };
          else {
            const fnResp = await fetch(supabaseUrl + "/functions/v1/" + funcName, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
              body: JSON.stringify(args.params || {}),
            });
            result = await fnResp.json();
          }
        } else if (fnName === "expert_forge") {
          toolLabel = "expert_forge";
          const efResp = await fetch(supabaseUrl + "/functions/v1/expert-forge-proxy", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: authHeader, apikey: anonKey },
            body: JSON.stringify({ question: args.question, specialist_id: args.specialist_id, context: args.context }),
          });
          result = await efResp.json();
        } else if (fnName === "generate_pdf_report") {
          toolLabel = "generate_pdf_report";
          result = { success: true, title: args.title, content: args.content };
        } else {
          result = { error: "Tool no reconocida" };
        }
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Error tool" };
      }

      toolResults.push({ tool: toolLabel, result });
    }

    // Synthesis
    const toolResultsSummary = toolResults.map(tr =>
      `[Resultado de ${tr.tool}]:\n${JSON.stringify(tr.result).substring(0, 6000)}`
    ).join("\n\n");

    const synthesisMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];
    if (cumulativeSummary) {
      synthesisMessages.push({
        role: "system",
        content: `CONTEXTO ACUMULADO (no contradecir):\n\n${cumulativeSummary}`,
      });
    }
    if (history && Array.isArray(history)) {
      const recent = history.length > 12 ? history.slice(-6) : history;
      for (const h of recent) synthesisMessages.push({ role: h.role, content: h.content });
    }
    synthesisMessages.push(
      { role: "user", content: effectiveMessage },
      { role: "assistant", content: `He ejecutado las siguientes herramientas:\n\n${toolResultsSummary}` },
      { role: "user", content: "Responde de forma completa, detallada y profesional, desde la lente de centros comerciales y retail. Si los datos son insuficientes, complementa con conocimiento del sector. Markdown rico, en español." },
    );

    let finalAnswer = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const synthesisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL_MAIN,
          messages: attempt === 0 ? synthesisMessages : [
            { role: "system", content: "Eres ABA, asistente de centros comerciales. Responde en español con markdown rico." },
            { role: "user", content: `Pregunta: ${effectiveMessage}\n\nDatos:\n${toolResultsSummary}\n\nResponde completo y profesional.` },
          ],
        }),
      });
      if (synthesisResponse.ok) {
        const synthesisData = await synthesisResponse.json();
        finalAnswer = synthesisData.choices?.[0]?.message?.content || "";
        const usage2 = synthesisData.usage || {};
        totalTokensIn += usage2.prompt_tokens || 0;
        totalTokensOut += usage2.completion_tokens || 0;
        if (finalAnswer) break;
      } else {
        console.error(`ABA synthesis attempt ${attempt + 1} failed:`, synthesisResponse.status);
      }
    }
    if (!finalAnswer) finalAnswer = firstCallContent || formatToolResultsFallback(toolResults);

    const latencyMs = Date.now() - startTime;
    const costEur = totalTokensIn * GEMINI_INPUT + totalTokensOut * GEMINI_OUTPUT;

    await admin.from("auditoria_ia").insert({
      modelo: MODEL_MAIN, funcion_ia: "aba-orchestrator",
      latencia_ms: latencyMs, tokens_entrada: totalTokensIn, tokens_salida: totalTokensOut,
      coste_estimado: costEur, exito: true, created_by: user.id,
    });
    await admin.from("usage_logs").insert({
      user_id: user.id, action_type: "chat", agent_label: "ABA Orchestrator",
      model: MODEL_MAIN, tokens_input: totalTokensIn, tokens_output: totalTokensOut,
      cost_eur: costEur, latency_ms: latencyMs,
      metadata: { tools_used: toolResults.map(tr => tr.tool), attachments: attachmentTools, message: (message || "").slice(0, 200) },
    });

    const pdfTool = toolResults.find(tr => tr.tool === "generate_pdf_report" && tr.result?.success);
    return new Response(JSON.stringify({
      answer: finalAnswer,
      tools_used: [...attachmentTools, ...toolResults.map(tr => tr.tool)],
      latency_ms: latencyMs,
      ...(pdfTool ? { pdf_content: pdfTool.result.content, pdf_title: pdfTool.result.title } : {}),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("aba-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
