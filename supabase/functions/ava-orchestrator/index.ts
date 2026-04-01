import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Eres AVA, la asistente inteligente de gestión de centros comerciales de F&G Real Estate. Tienes acceso completo a la base de datos (locales, operadores, contactos, documentos, negociaciones), a 6 especialistas de IA (localización, tenant mix, validación, negociación, auditoría, matching), y a funciones de análisis avanzado. Puedes consultar datos, modificarlos, ejecutar análisis, y asistir proactivamente. Responde siempre en español. Sé concisa pero completa.`;

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

    // If no tool calls, return direct response
    if (!choice?.tool_calls || choice.tool_calls.length === 0) {
      const latencyMs = Date.now() - startTime;
      await admin.from("auditoria_ia").insert({
        modelo: "google/gemini-3-flash-preview",
        funcion_ia: "ava-orchestrator",
        latencia_ms: latencyMs,
        exito: true,
        created_by: user.id,
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
    const synthesisMessages = [
      ...messages,
      { role: "assistant", content: choice.content || "", tool_calls: choice.tool_calls },
      ...toolMessages,
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

    let finalAnswer: string;
    if (synthesisResponse.ok) {
      const synthesisData = await synthesisResponse.json();
      finalAnswer = synthesisData.choices?.[0]?.message?.content || "He procesado tu solicitud pero no pude formular una respuesta.";
    } else {
      await synthesisResponse.text();
      // Fallback: summarize tool results
      finalAnswer = "He consultado los datos. Resultados:\n\n" +
        toolResults.map(tr => `**${tr.tool}**: ${JSON.stringify(tr.result).substring(0, 500)}`).join("\n\n");
    }

    const latencyMs = Date.now() - startTime;

    // Audit
    await admin.from("auditoria_ia").insert({
      modelo: "google/gemini-3-flash-preview",
      funcion_ia: "ava-orchestrator",
      latencia_ms: latencyMs,
      exito: true,
      created_by: user.id,
    });

    return new Response(JSON.stringify({
      answer: finalAnswer,
      tools_used: toolResults.map(tr => tr.tool),
      latency_ms: latencyMs,
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
