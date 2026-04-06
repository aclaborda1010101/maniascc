import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

## FORMATO DE RESPUESTA ESTRATÉGICA
Cuando hagas un análisis completo, estructura tu respuesta con:
- **Resumen ejecutivo** (2-3 líneas)
- **Datos del entorno** (competencia, servicios, accesibilidad)
- **Análisis de mercado** (demografía, potencial, tendencias)
- **Operadores ideales** (por sector, posicionamiento y compatibilidad)
- **Riesgos y oportunidades**
- **Recomendaciones estratégicas**

NUNCA digas "no tengo datos suficientes" sin antes haber consultado TODAS las fuentes disponibles y complementado con tu conocimiento general. Siempre aporta valor.

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
      description: "Genera un informe/documento profesional en formato PDF. Úsalo SOLO cuando el usuario pida explícitamente un informe, documento, dossier o reporte.",
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
    const { message, history } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Mensaje requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startTime = Date.now();
    const messages: Array<{ role: string; content: string; tool_call_id?: string }> = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add conversation history (last 10 messages for context)
    if (history && Array.isArray(history)) {
      for (const h of history.slice(-10)) {
        messages.push({ role: h.role, content: h.content });
      }
    }
    messages.push({ role: "user", content: message });

    // First AI call: determine intent and tools
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
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

    // Gemini 2.5 Pro pricing: $1.25/1M input, $10.00/1M output (converted to EUR)
    const GEMINI_INPUT = 1.25 / 1_000_000 * 0.92;
    const GEMINI_OUTPUT = 10.00 / 1_000_000 * 0.92;

    // If no tool calls, return direct response
    if (!choice?.tool_calls || choice.tool_calls.length === 0) {
      const latencyMs = Date.now() - startTime;
      const costEur = totalTokensIn * GEMINI_FLASH_INPUT + totalTokensOut * GEMINI_FLASH_OUTPUT;
      await admin.from("auditoria_ia").insert({
        modelo: "google/gemini-3-flash-preview",
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
        model: "gemini-3-flash-preview",
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

    const synthesisMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history && Array.isArray(history) ? history.slice(-10).map((h: any) => ({ role: h.role, content: h.content })) : []),
      { role: "user", content: message },
      { 
        role: "assistant", 
        content: `He ejecutado las siguientes herramientas para responder a la pregunta del usuario. Aquí están los resultados obtenidos:\n\n${toolResultsSummary}`
      },
      { role: "user", content: "Basándote en los datos obtenidos y en tu conocimiento general del sector retail e inmobiliario comercial, responde de forma completa, detallada y profesional a mi pregunta original. Si los datos de la base de datos están vacíos o no son suficientes, complementa con tu conocimiento general. NUNCA respondas que no puedes formular una respuesta. Siempre ofrece análisis, recomendaciones y valor. Responde en español." },
    ];

    const synthesisResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: synthesisMessages,
      }),
    });

    // Use first call's partial content as fallback base
    const firstCallContent = choice?.content || "";
    
    let finalAnswer: string;
    if (synthesisResponse.ok) {
      const synthesisData = await synthesisResponse.json();
      finalAnswer = synthesisData.choices?.[0]?.message?.content || "";
      if (!finalAnswer) {
        console.error("Empty synthesis response:", JSON.stringify(synthesisData).substring(0, 1000));
        // Fallback: use first call content if available, otherwise format tool results
        finalAnswer = firstCallContent || formatToolResultsFallback(toolResults);
      }
      const usage2 = synthesisData.usage || {};
      totalTokensIn += usage2.prompt_tokens || 0;
      totalTokensOut += usage2.completion_tokens || 0;
    } else {
      const errBody = await synthesisResponse.text();
      console.error("Synthesis call failed:", synthesisResponse.status, errBody);
      // Fallback: prefer first call content, then formatted tool results
      finalAnswer = firstCallContent || formatToolResultsFallback(toolResults);
    }

    const latencyMs = Date.now() - startTime;
    const costEur = totalTokensIn * GEMINI_FLASH_INPUT + totalTokensOut * GEMINI_FLASH_OUTPUT;

    // Audit
    await admin.from("auditoria_ia").insert({
      modelo: "google/gemini-3-flash-preview",
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
      model: "gemini-3-flash-preview",
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
