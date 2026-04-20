import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fetch with retry on transient gateway errors (502/503/504) + network errors
async function fetchAIWithRetry(url: string, init: RequestInit, maxAttempts = 3): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const resp = await fetch(url, init);
      if (resp.ok) return resp;
      // Retry only on transient upstream errors
      if ([502, 503, 504].includes(resp.status) && attempt < maxAttempts) {
        const body = await resp.text().catch(() => "");
        console.warn(`AI gateway transient ${resp.status} (attempt ${attempt}/${maxAttempts}): ${body.slice(0, 200)}`);
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue;
      }
      return resp;
    } catch (e) {
      lastErr = e;
      console.warn(`AI gateway network error (attempt ${attempt}/${maxAttempts}):`, e);
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 500 * attempt));
    }
  }
  throw lastErr ?? new Error("AI gateway unreachable");
}

const SYSTEM_PROMPT = `Eres AVA, la asistente estratégica de F&G Real Estate especializada en retail e inmobiliario comercial. Tienes acceso a:
1. BASE DE DATOS interna: locales, operadores, contactos, activos, proyectos/oportunidades, matches, negociaciones, documentos
2. RAG (Retrieval-Augmented Generation): documentos indexados segmentados por dominio (contratos, operadores, activos, mercado, personas)
3. NEARBY SEARCH: análisis geográfico de POIs via OpenStreetMap (competencia, restauración, transporte, servicios)
4. EXPERT FORGE: sistema MoE con 7 especialistas IA
5. INTELIGENCIA AVANZADA: localización, tenant mix, validación dossier, negociación
6. TU CONOCIMIENTO GENERAL del sector retail, centros comerciales, demografía, urbanismo y mercado inmobiliario

## REGLA FUNDAMENTAL DE ANÁLISIS MULTI-FUENTE
Cuando el usuario pregunte sobre un centro comercial, ubicación, zona comercial, operador o cualquier tema estratégico, SIEMPRE debes combinar AUTOMÁTICAMENTE múltiples fuentes de datos. NO te limites a una sola herramienta. Usa VARIAS en paralelo:

### Para preguntas sobre CENTROS COMERCIALES o UBICACIONES:
1. **db_query** en locales/activos/operadores para datos internos del centro
2. **rag_search** para buscar documentos relevantes (informes de mercado, contratos, benchmarks)
3. **nearby_search** con MÚLTIPLES queries: "supermarket", "fast_food", "fuel", "shopping", "bus_stop", "school", "restaurant" para analizar competencia, servicios, accesibilidad y entorno
4. **Tu conocimiento general** para añadir contexto de mercado, tendencias del sector, demografía estimada

### Para preguntas sobre OPERADORES:
1. **db_query** en operadores + contactos + matches para datos internos
2. **rag_search** para documentos asociados y benchmarks del sector
3. **Tu conocimiento** sobre el operador (si es conocido), su posicionamiento, expansión habitual, ticket medio

### Para preguntas ESTRATÉGICAS (viabilidad, tenant mix, competencia):
1. Usa TODAS las herramientas relevantes
2. Cruza datos internos con análisis geográfico
3. Complementa SIEMPRE con tu conocimiento del mercado retail español e internacional
4. Ofrece comparables, benchmarks y recomendaciones accionables

## FORMATO DE RESPUESTA — MARKDOWN RICO OBLIGATORIO
SIEMPRE formatea tus respuestas usando markdown rico. Esto es OBLIGATORIO en CADA respuesta:
- **Encabezados** (## y ###) para separar secciones claramente
- **Tablas markdown** para cualquier comparativa, listado de operadores, métricas o datos tabulares
- **Negritas** (**texto**) para cifras clave, nombres importantes y conclusiones
- **Emojis** como indicadores visuales: 📊 datos, 🏪 retail, 📍 ubicación, ⚠️ riesgos, ✅ oportunidades, 🎯 recomendaciones, 💰 financiero, 🚗 accesibilidad, 👥 demografía, 📈 tendencias
- **Listas** (- y 1. 2. 3.) para enumerar puntos, nunca párrafos largos sin estructura
- **Separadores** (---) entre secciones principales
- **Bloques de cita** (>) para destacar conclusiones o insights clave

Para análisis completos, estructura SIEMPRE con:
- 📊 **Resumen ejecutivo** (2-3 líneas)
- 📍 **Datos del entorno** (competencia, servicios, accesibilidad)
- 👥 **Análisis de mercado** (demografía, potencial, tendencias)
- 🏪 **Operadores ideales** (tabla con sector, posicionamiento y compatibilidad)
- ⚠️ **Riesgos y oportunidades**
- 🎯 **Recomendaciones estratégicas**

NUNCA respondas en texto plano sin formato. NUNCA digas "no tengo datos suficientes" sin antes haber consultado TODAS las fuentes disponibles y complementado con tu conocimiento general. Siempre aporta valor.

Responde siempre en español. Sé profesional, detallada y estratégica.

IMPORTANTE SOBRE INFORMES PDF: Cuando el usuario te pida explícitamente que generes un informe, documento, dossier o reporte, usa la herramienta generate_pdf_report. NO uses esta herramienta para respuestas normales de chat.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "db_query",
      description: "Consulta datos de cualquier tabla de AVA: locales, operadores, contactos, documentos_proyecto, negociaciones, proyectos, matches, activos, perfiles_negociador, validaciones_retorno, configuraciones_tenant_mix, patrones_localizacion",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Nombre de la tabla a consultar" },
          select: { type: "string", description: "Columnas a seleccionar (formato Supabase select). Default: *" },
          filters: {
            type: "array",
            description: "Array de filtros [{column, operator, value}]. Operators: eq, neq, gt, gte, lt, lte, like, ilike",
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
          limit: { type: "number", description: "Número máximo de filas. Default: 20" },
          order_by: { type: "string", description: "Columna para ordenar" },
          ascending: { type: "boolean", description: "Orden ascendente. Default: false" },
        },
        required: ["table"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "db_mutate",
      description: "Modifica datos en la base de datos. Acciones: insert o update",
      parameters: {
        type: "object",
        properties: {
          table: { type: "string", description: "Tabla a modificar" },
          action: { type: "string", enum: ["insert", "update"] },
          data: { type: "object", description: "Datos a insertar o actualizar" },
          match: { type: "object", description: "Filtros para update (ej: {id: '...'})" },
        },
        required: ["table", "action", "data"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "expert_forge",
      description: "Consulta al sistema Expert Forge MoE+RAG para obtener respuestas especializadas de los 7 agentes IA",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pregunta en lenguaje natural" },
          specialist_id: { type: "string", description: "UUID del especialista (opcional, el MoE Router decide si no se especifica)" },
          context: { type: "string", description: "Contexto adicional" },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_intelligence",
      description: "Ejecuta una función de inteligencia avanzada: análisis de localización, optimización tenant mix, validación de dossier, o perfil de negociación",
      parameters: {
        type: "object",
        properties: {
          function_name: { type: "string", enum: ["localizacion", "tenant_mix", "validacion", "negociacion"], description: "Función a ejecutar" },
          params: { type: "object", description: "Parámetros específicos de la función" },
        },
        required: ["function_name", "params"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_data",
      description: "Búsqueda semántica en los datos de AVA por nombre, descripción, etc.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto de búsqueda" },
          tables: {
            type: "array",
            items: { type: "string", enum: ["locales", "operadores", "contactos", "proyectos", "documentos_proyecto"] },
            description: "Tablas donde buscar",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "nearby_search",
      description: "Busca puntos de interés (POIs) cercanos a unas coordenadas usando OpenStreetMap. Úsalo para analizar entornos comerciales: McDonald's, gasolineras, supermercados, centros comerciales, transporte, etc.",
      parameters: {
        type: "object",
        properties: {
          lat: { type: "number", description: "Latitud del punto central" },
          lon: { type: "number", description: "Longitud del punto central" },
          radius_m: { type: "number", description: "Radio de búsqueda en metros (default 2000)" },
          query: { type: "string", description: "Tipo de POI a buscar, ej: restaurant, fuel, supermarket, school, hospital, shopping, fast_food, bus_stop" },
        },
        required: ["lat", "lon", "query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rag_search",
      description: "Busca en los documentos RAG indexados (informes de mercado, contratos, benchmarks, análisis sectoriales). Usa para complementar datos de la BD con conocimiento documental. Dominios: contratos, operadores, activos, mercado, personas, general.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "Pregunta o tema a buscar en los documentos RAG" },
          dominio: { type: "string", enum: ["contratos", "operadores", "activos", "mercado", "personas", "general"], description: "Dominio/categoría de documentos a consultar. Opcional." },
          proyecto_id: { type: "string", description: "UUID del proyecto para filtrar documentos específicos. Opcional." },
        },
        required: ["question"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_pdf_report",
      description: "Genera un informe en PDF con plantilla GENÉRICA (markdown→PDF). Úsalo solo para reportes simples cuando NO encaje ninguno de los 6 modos FORGE.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título del informe" },
          content: { type: "string", description: "Contenido completo del informe en formato Markdown con secciones bien estructuradas" },
        },
        required: ["title", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_forge_document",
      description: "Genera un documento PROFESIONAL premium con plantilla FORGE (maquetación tipo McKinsey/Cushman). PREFERIDO sobre generate_pdf_report cuando el usuario pida: dossier de operador, presentación comercial / teaser, borrador de contrato de arrendamiento, plan estratégico, informe war room semanal, o un email profesional. Detecta el modo correcto según el intent.",
      parameters: {
        type: "object",
        properties: {
          mode: {
            type: "string",
            enum: ["dossier_operador", "presentacion_comercial", "borrador_contrato", "plan_estrategico", "informe_war_room", "email_comunicacion"],
            description: "Modo FORGE: dossier_operador (perfil de marca/retailer), presentacion_comercial (teaser de activo), borrador_contrato (arrendamiento), plan_estrategico (plan McKinsey-style), informe_war_room (dashboard semanal), email_comunicacion (email profesional)",
          },
          context: { type: "string", description: "Instrucciones y contexto detallado para FORGE: a quién va dirigido, qué activo/operador, qué objetivo, datos clave a incluir." },
          proyecto_id: { type: "string", description: "UUID del proyecto si aplica (opcional, mejora el contexto RAG)." },
        },
        required: ["mode", "context"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_system_document",
      description: "Localiza y lee documentos ya almacenados en el sistema (tabla documentos_proyecto). Búsqueda por nombre, devuelve nombre + resumen IA + texto extraído de los chunks RAG si existen. Úsalo cuando el usuario mencione un documento por su nombre ('mira el contrato de Mercadona', 'según el dossier de la Milla')",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar en el nombre del documento" },
          documento_id: { type: "string", description: "UUID exacto si ya se conoce (opcional)" },
        },
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
  "ai_insights", "ai_feedback", "notificaciones", "proyecto_operadores",
  "proyecto_contactos", "proyecto_equipo", "sinergias_operadores",
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

// Summarize older history messages using a cheap/fast model to preserve context
async function summarizeOlderHistory(
  olderMessages: Array<{ role: string; content: string }>,
  lovableKey: string
): Promise<string> {
  const conversationText = olderMessages.map(m => 
    `${m.role === "user" ? "USUARIO" : "AVA"}: ${m.content.substring(0, 2000)}`
  ).join("\n\n");

  try {
    const resp = await fetchAIWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { 
            role: "system", 
            content: `Eres un asistente que resume conversaciones de trabajo sobre inmobiliario comercial y retail.
Tu ÚNICA tarea es extraer y listar TODOS los hechos clave, restricciones, decisiones y datos mencionados.

REGLAS:
- Lista cada hecho como un bullet point conciso
- NO omitas NINGUNA restricción o corrección del usuario
- Incluye: nombres de operadores, datos de superficie, ubicaciones, competidores cercanos, operadores ya existentes, decisiones tomadas
- Incluye correcciones explícitas del usuario (ej: "ya hay un KFC enfrente", "no hay superficie para X")
- Máximo 800 palabras` 
          },
          { 
            role: "user", 
            content: `Resume los hechos clave de esta conversación:\n\n${conversationText}` 
          }
        ],
      }),
    });

    if (!resp.ok) {
      console.error("Summary call failed:", resp.status);
      return "";
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || "";
  } catch (e) {
    console.error("Error summarizing history:", e);
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

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    let body: any = {};
    try {
      const raw = await req.text();
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      return new Response(JSON.stringify({ error: "Body JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { message, history, attachments_context } = body;
    if (!message) {
      return new Response(JSON.stringify({ error: "Mensaje requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();

    // Load learned patterns + recent corrections to inject as system context
    let lessonsBlock = "";
    try {
      const { data: patterns } = await admin
        .from("ai_learned_patterns")
        .select("patron_tipo, patron_key, patron_descripcion, tasa_exito, num_observaciones, score_ajuste, confianza")
        .eq("activo", true)
        .gte("confianza", 0.6)
        .order("num_observaciones", { ascending: false })
        .limit(30);

      const { data: corrections } = await admin
        .from("ai_feedback")
        .select("correccion_sugerida, comentario, contexto, created_at")
        .eq("entidad_tipo", "ava_message")
        .not("correccion_sugerida", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      const lessons: string[] = [];
      for (const p of patterns || []) {
        const sign = (p.score_ajuste ?? 0) >= 0 ? "✅" : "⚠️";
        const tasa = p.tasa_exito != null ? ` (éxito ${(p.tasa_exito * 100).toFixed(0)}%, n=${p.num_observaciones})` : "";
        lessons.push(`${sign} ${p.patron_descripcion}${tasa}`);
      }
      const corrLines: string[] = [];
      for (const c of corrections || []) {
        if (c.correccion_sugerida) corrLines.push(`- "${(c.correccion_sugerida as string).slice(0, 250)}"`);
      }
      if (lessons.length > 0 || corrLines.length > 0) {
        lessonsBlock = `\n\n## LECCIONES APRENDIDAS DEL FEEDBACK DEL USUARIO\nAplica SIEMPRE estas lecciones cuando el contexto lo permita. Son aprendizajes acumulados de interacciones reales.\n\n${lessons.join("\n")}`;
        if (corrLines.length > 0) {
          lessonsBlock += `\n\n### Correcciones recientes que NO debes repetir:\n${corrLines.join("\n")}`;
        }
      }
    } catch (e) {
      console.warn("Could not load learned patterns:", e);
    }

    const attachmentsBlock = attachments_context
      ? `\n\n## DOCUMENTOS ADJUNTOS POR EL USUARIO EN ESTA PETICIÓN\nUsa SIEMPRE este contenido como fuente prioritaria. NO ignores ningún dato del adjunto.\n\n${attachments_context}`
      : "";

    const messages: Array<{ role: string; content: string; tool_call_id?: string }> = [
      { role: "system", content: SYSTEM_PROMPT + lessonsBlock + attachmentsBlock },
    ];

    // Build context with cumulative summary for long conversations
    let cumulativeSummary = "";
    if (history && Array.isArray(history)) {
      if (history.length > 12) {
        // Split: older messages get summarized, recent 6 stay raw
        const olderMessages = history.slice(0, history.length - 6);
        const recentMessages = history.slice(-6);
        
        cumulativeSummary = await summarizeOlderHistory(olderMessages, lovableKey);
        
        if (cumulativeSummary) {
          messages.push({
            role: "system",
            content: `CONTEXTO ACUMULADO DE LA CONVERSACIÓN (hechos establecidos que NO debes contradecir bajo ninguna circunstancia):\n\n${cumulativeSummary}`
          });
        }
        
        for (const h of recentMessages) {
          messages.push({ role: h.role, content: h.content });
        }
      } else {
        // Short conversation: send all messages
        for (const h of history) {
          messages.push({ role: h.role, content: h.content });
        }
      }
    }
    messages.push({ role: "user", content: message });

    // First AI call: determine intent and tools
    const aiResponse = await fetchAIWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones excedido, intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Transient upstream (502/503/504) after retries → friendly message
      return new Response(JSON.stringify({
        error: "El servicio de IA está temporalmente saturado. Por favor, vuelve a intentarlo en unos segundos.",
        transient: true,
      }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0]?.message;
    const usage1 = aiData.usage || {};
    let totalTokensIn = usage1.prompt_tokens || 0;
    let totalTokensOut = usage1.completion_tokens || 0;

    // Gemini 3.1 Pro Preview pricing (estimated same tier)
    const GEMINI_INPUT = 1.25 / 1_000_000 * 0.92;
    const GEMINI_OUTPUT = 10.00 / 1_000_000 * 0.92;

    // If no tool calls, return direct response
    if (!choice?.tool_calls || choice.tool_calls.length === 0) {
      const latencyMs = Date.now() - startTime;
      const costEur = totalTokensIn * GEMINI_INPUT + totalTokensOut * GEMINI_OUTPUT;
      await admin.from("auditoria_ia").insert({
        modelo: "google/gemini-3.1-pro-preview",
        funcion_ia: "ava-orchestrator",
        latencia_ms: latencyMs,
        tokens_entrada: totalTokensIn,
        tokens_salida: totalTokensOut,
        coste_estimado: costEur,
        exito: true,
        created_by: user.id,
      });
      await admin.from("usage_logs").insert({
        user_id: user.id,
        action_type: "chat",
        agent_label: "AVA Orchestrator",
      model: "google/gemini-3.1-pro-preview",
        tokens_input: totalTokensIn,
        tokens_output: totalTokensOut,
        cost_eur: costEur,
        latency_ms: latencyMs,
        metadata: { direct_answer: true, message: message?.slice(0, 200) },
      });
      return new Response(JSON.stringify({
        answer: choice?.content || "No tengo una respuesta para eso.",
        tools_used: [],
        latency_ms: latencyMs,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Execute tool calls
    const toolResults: Array<{ tool: string; result: any }> = [];
    const toolMessages: Array<{ role: string; content: string; tool_call_id?: string }> = [];

    for (const toolCall of choice.tool_calls) {
      const fnName = toolCall.function.name;
      let args: any;
      try {
        args = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch {
        args = {};
      }

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
              for (const f of args.filters) {
                query = (query as any)[f.operator](f.column, f.value);
              }
            }
            if (args.order_by) {
              query = query.order(args.order_by, { ascending: args.ascending ?? false });
            }
            query = query.limit(args.limit || 20);
            const { data, error } = await query;
            result = error ? { error: error.message } : data;
          }
        } else if (fnName === "db_mutate") {
          toolLabel = "db_mutate:" + (args.table || "") + ":" + (args.action || "");
          if (!ALLOWED_TABLES.includes(args.table)) {
            result = { error: "Tabla no permitida: " + args.table };
          } else if (args.action === "insert") {
            const { data, error } = await admin.from(args.table).insert({ ...args.data, created_by: user.id }).select();
            result = error ? { error: error.message } : data;
          } else if (args.action === "update") {
            if (!args.match || !args.match.id) {
              result = { error: "Se requiere match.id para update" };
            } else {
              let query = admin.from(args.table).update(args.data);
              for (const [k, v] of Object.entries(args.match)) {
                query = query.eq(k, v as string);
              }
              const { data, error } = await query.select();
              result = error ? { error: error.message } : data;
            }
          } else {
            result = { error: "Acción no soportada" };
          }
        } else if (fnName === "expert_forge") {
          toolLabel = "expert_forge";
          const efUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/expert-forge-proxy";
          const efResp = await fetch(efUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: authHeader,
              apikey: anonKey,
            },
            body: JSON.stringify({
              question: args.question,
              specialist_id: args.specialist_id,
              context: args.context,
            }),
          });
          result = await efResp.json();
        } else if (fnName === "run_intelligence") {
          toolLabel = "run_intelligence:" + (args.function_name || "");
          const funcName = INTELLIGENCE_FUNCTIONS[args.function_name];
          if (!funcName) {
            result = { error: "Función no reconocida: " + args.function_name };
          } else {
            const fnUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/" + funcName;
            const fnResp = await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                apikey: anonKey,
              },
              body: JSON.stringify(args.params || {}),
            });
            result = await fnResp.json();
          }
        } else if (fnName === "search_data") {
          toolLabel = "search_data";
          const searchTables = args.tables || ["locales", "operadores", "contactos", "proyectos"];
          const searchResults: Record<string, any[]> = {};
          const q = "%" + (args.query || "") + "%";
          for (const t of searchTables) {
            if (!ALLOWED_TABLES.includes(t)) continue;
            let searchQuery;
            if (t === "locales") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",ciudad.ilike." + q + ",direccion.ilike." + q).limit(10);
            } else if (t === "operadores") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",sector.ilike." + q).limit(10);
            } else if (t === "contactos") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",empresa.ilike." + q + ",email.ilike." + q).limit(10);
            } else if (t === "proyectos") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q + ",descripcion.ilike." + q).limit(10);
            } else if (t === "documentos_proyecto") {
              searchQuery = admin.from(t).select("*").or("nombre.ilike." + q).limit(10);
            } else {
              continue;
            }
            const { data } = await searchQuery;
            if (data && data.length > 0) searchResults[t] = data;
          }
          result = searchResults;
        } else if (fnName === "nearby_search") {
          toolLabel = "nearby_search:" + (args.query || "");
          const radius = args.radius_m || 2000;
          const lat = args.lat;
          const lon = args.lon;
          const q = args.query || "";

          // Map common queries to Overpass tags
          const tagMap: Record<string, string> = {
            restaurant: '["amenity"="restaurant"]',
            fast_food: '["amenity"="fast_food"]',
            fuel: '["amenity"="fuel"]',
            supermarket: '["shop"="supermarket"]',
            school: '["amenity"="school"]',
            hospital: '["amenity"="hospital"]',
            shopping: '["shop"="mall"]',
            bus_stop: '["highway"="bus_stop"]',
            pharmacy: '["amenity"="pharmacy"]',
            bank: '["amenity"="bank"]',
            parking: '["amenity"="parking"]',
          };

          let overpassFilter = tagMap[q];
          if (!overpassFilter) {
            // Name search for specific brands
            overpassFilter = `["name"~"${q}",i]`;
          }

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
                lat: elLat,
                lon: elLon,
                distance_m: dist,
                address: el.tags?.["addr:street"] ? `${el.tags["addr:street"]} ${el.tags["addr:housenumber"] || ""}`.trim() : undefined,
              };
            }).sort((a: any, b: any) => (a.distance_m || 9999) - (b.distance_m || 9999));
            result = { query: q, radius_m: radius, center: { lat, lon }, count: pois.length, pois };
          } catch (e) {
            result = { error: "Error consultando Overpass API: " + (e instanceof Error ? e.message : "desconocido") };
          }
        } else if (fnName === "rag_search") {
          toolLabel = "rag_search:" + (args.dominio || "general");
          const ragUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/rag-proxy";
          try {
            const ragResp = await fetch(ragUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                apikey: anonKey,
              },
              body: JSON.stringify({
                question: args.question,
                filters: {
                  dominio: args.dominio || undefined,
                  proyecto_id: args.proyecto_id || undefined,
                },
              }),
            });
            const ragData = await ragResp.json();
            result = ragData;
          } catch (e) {
            result = { error: "Error consultando RAG: " + (e instanceof Error ? e.message : "desconocido") };
          }
        } else if (fnName === "generate_pdf_report") {
          toolLabel = "generate_pdf_report";
          result = { success: true, title: args.title, content: args.content };
        } else if (fnName === "generate_forge_document") {
          toolLabel = "generate_forge_document:" + (args.mode || "");
          try {
            const forgeUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/ai-forge";
            const forgeResp = await fetch(forgeUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: authHeader,
                apikey: anonKey,
              },
              body: JSON.stringify({
                mode: args.mode,
                context: args.context,
                proyecto_id: args.proyecto_id,
                format: "structured",
              }),
            });
            const forgeData = await forgeResp.json();
            if (!forgeResp.ok || forgeData?.error || !forgeData?.structured) {
              result = { success: false, error: forgeData?.error || "FORGE no devolvió estructura válida" };
            } else {
              // Now render PDF via generate-pdf-v2 (returns binary PDF). Save to documentos_generados bucket.
              const pdfUrl = Deno.env.get("SUPABASE_URL") + "/functions/v1/generate-pdf-v2";
              const pdfResp = await fetch(pdfUrl, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: authHeader,
                  apikey: anonKey,
                },
                body: JSON.stringify({
                  mode: args.mode,
                  data: forgeData.structured,
                  mode_label: args.mode,
                  output: "pdf",
                }),
              });
              if (!pdfResp.ok) {
                result = { success: false, error: `PDF render failed (${pdfResp.status})`, structured: forgeData.structured };
              } else {
                const pdfBlob = await pdfResp.arrayBuffer();
                const pdfBytes = new Uint8Array(pdfBlob);
                const fileName = `ava_${args.mode}_${Date.now()}.pdf`;
                const storagePath = `${user.id}/${fileName}`;
                const { error: upErr } = await admin.storage
                  .from("documentos_generados")
                  .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: false });
                if (upErr) {
                  result = { success: false, error: "Upload PDF failed: " + upErr.message };
                } else {
                  const { data: signed } = await admin.storage
                    .from("documentos_generados")
                    .createSignedUrl(storagePath, 60 * 60 * 24); // 24h
                  result = {
                    success: true,
                    mode: args.mode,
                    file_name: fileName,
                    storage_path: storagePath,
                    download_url: signed?.signedUrl || null,
                    title: forgeData.structured?.cover?.title || args.mode,
                  };
                }
              }
            }
          } catch (e) {
            result = { success: false, error: e instanceof Error ? e.message : "Error FORGE" };
          }
        } else if (fnName === "read_system_document") {
          toolLabel = "read_system_document";
          try {
            let docs: any[] = [];
            if (args.documento_id) {
              const { data } = await admin.from("documentos_proyecto")
                .select("id, nombre, resumen_ia, storage_path, mime_type")
                .eq("id", args.documento_id).limit(1);
              docs = data || [];
            } else if (args.query) {
              const { data } = await admin.from("documentos_proyecto")
                .select("id, nombre, resumen_ia, storage_path, mime_type")
                .ilike("nombre", `%${args.query}%`).limit(3);
              docs = data || [];
            }
            if (docs.length === 0) {
              result = { found: false, message: "No se encontró ningún documento con ese nombre." };
            } else {
              // Fetch chunks for each doc
              const enriched = [];
              for (const d of docs) {
                const { data: chunks } = await admin.from("document_chunks")
                  .select("contenido")
                  .eq("documento_id", d.id)
                  .order("chunk_index", { ascending: true })
                  .limit(20);
                const fullText = (chunks || []).map((c: any) => c.contenido).join("\n\n").slice(0, 12000);
                enriched.push({
                  id: d.id,
                  nombre: d.nombre,
                  resumen_ia: d.resumen_ia,
                  contenido: fullText || "(sin chunks indexados, usa rag_search)",
                });
              }
              result = { found: true, documents: enriched };
            }
          } catch (e) {
            result = { error: e instanceof Error ? e.message : "Error leyendo documento" };
          }
        } else {
          result = { error: "Tool no reconocida" };
        }
      } catch (e) {
        result = { error: e instanceof Error ? e.message : "Error ejecutando tool" };
      }

      toolResults.push({ tool: toolLabel, result });
      toolMessages.push({
        role: "tool",
        content: JSON.stringify(result).substring(0, 8000),
        tool_call_id: toolCall.id,
      });
    }

    // Second AI call: synthesize response with tool results
    // Build a simpler synthesis prompt that works reliably with Gemini
    const toolResultsSummary = toolResults.map(tr => 
      `[Resultado de ${tr.tool}]:\n${JSON.stringify(tr.result).substring(0, 6000)}`
    ).join("\n\n");

    // Build synthesis messages with cumulative summary + lessons
    const synthesisMessages: Array<{ role: string; content: string }> = [
      { role: "system", content: SYSTEM_PROMPT + lessonsBlock },
    ];
    
    if (cumulativeSummary) {
      synthesisMessages.push({
        role: "system",
        content: `CONTEXTO ACUMULADO DE LA CONVERSACIÓN (hechos establecidos que NO debes contradecir bajo ninguna circunstancia):\n\n${cumulativeSummary}`
      });
    }

    if (history && Array.isArray(history)) {
      const recentForSynthesis = history.length > 12 ? history.slice(-6) : history;
      for (const h of recentForSynthesis) {
        synthesisMessages.push({ role: h.role, content: h.content });
      }
    }

    synthesisMessages.push(
      { role: "user", content: message },
      { 
        role: "assistant", 
        content: `He ejecutado las siguientes herramientas para responder a la pregunta del usuario. Aquí están los resultados obtenidos:\n\n${toolResultsSummary}`
      },
      { role: "user", content: "Basándote en los datos obtenidos y en tu conocimiento general del sector retail e inmobiliario comercial, responde de forma completa, detallada y profesional a mi pregunta original. Si los datos de la base de datos están vacíos o no son suficientes, complementa con tu conocimiento general. NUNCA respondas que no puedes formular una respuesta. Siempre ofrece análisis, recomendaciones y valor. Responde en español." },
    );

    let finalAnswer: string = "";
    
    // Try synthesis up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
      const synthesisResponse = await fetchAIWithRetry("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.1-pro-preview",
          messages: attempt === 0 ? synthesisMessages : [
            // Simplified retry: just system + tool results + question
            { role: "system", content: "Eres AVA, asistente estratégica de inmobiliario comercial. Responde en español con markdown rico." },
            { role: "user", content: `Pregunta del usuario: ${message}\n\nDatos obtenidos:\n${toolResultsSummary}\n\nResponde de forma completa y profesional.` },
          ],
        }),
      });

      if (synthesisResponse.ok) {
        const synthesisData = await synthesisResponse.json();
        finalAnswer = synthesisData.choices?.[0]?.message?.content || "";
        const usage2 = synthesisData.usage || {};
        totalTokensIn += usage2.prompt_tokens || 0;
        totalTokensOut += usage2.completion_tokens || 0;
        if (finalAnswer) break; // Success
        console.error(`Synthesis attempt ${attempt + 1} returned empty`);
      } else {
        const errBody = await synthesisResponse.text();
        console.error(`Synthesis attempt ${attempt + 1} failed:`, synthesisResponse.status, errBody);
      }
    }

    // Final fallback
    if (!finalAnswer) {
      finalAnswer = firstCallContent || formatToolResultsFallback(toolResults);
    }

    const latencyMs = Date.now() - startTime;
    const costEur = totalTokensIn * GEMINI_INPUT + totalTokensOut * GEMINI_OUTPUT;

    // Audit
    await admin.from("auditoria_ia").insert({
      modelo: "google/gemini-3.1-pro-preview",
      funcion_ia: "ava-orchestrator",
      latencia_ms: latencyMs,
      tokens_entrada: totalTokensIn,
      tokens_salida: totalTokensOut,
      coste_estimado: costEur,
      exito: true,
      created_by: user.id,
    });

    // Usage log for cost tracking
    await admin.from("usage_logs").insert({
      user_id: user.id,
      action_type: "chat",
      agent_label: "AVA Orchestrator",
      model: "google/gemini-3.1-pro-preview",
      tokens_input: totalTokensIn,
      tokens_output: totalTokensOut,
      cost_eur: costEur,
      latency_ms: latencyMs,
      metadata: { tools_used: toolResults.map(tr => tr.tool), message: message?.slice(0, 200) },
    });

    // Check if generate_pdf_report was used
    const pdfTool = toolResults.find(tr => tr.tool === "generate_pdf_report" && tr.result?.success);

    return new Response(JSON.stringify({
      answer: finalAnswer,
      tools_used: toolResults.map(tr => tr.tool),
      latency_ms: latencyMs,
      ...(pdfTool ? { pdf_content: pdfTool.result.content, pdf_title: pdfTool.result.title } : {}),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("ava-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
