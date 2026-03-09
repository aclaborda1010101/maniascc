import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI Background Agent — Analyzes projects, documents, and operators 
 * to detect opportunities, risks, and generate proactive insights.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const startTime = Date.now();

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await anonClient.auth.getUser();
    if (!claims?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { proyecto_id, agent_type = "opportunity_detector" } = await req.json();

    // Create task record
    const { data: taskRecord } = await admin.from("ai_agent_tasks").insert({
      agente_tipo: agent_type,
      estado: "processing",
      entidad_tipo: "proyecto",
      entidad_id: proyecto_id,
      iniciado_en: new Date().toISOString(),
      creado_por: claims.user.id,
      prioridad: 7,
    }).select().single();

    // Gather all project context
    const [
      { data: proyecto },
      { data: matches },
      { data: operadores },
      { data: activos },
      { data: docs },
      { data: negociaciones },
      { data: patterns },
    ] = await Promise.all([
      admin.from("proyectos").select("*").eq("id", proyecto_id).single(),
      admin.from("matches").select("*, operadores(nombre, sector)").eq("local_id", proyecto_id).order("score", { ascending: false }).limit(20),
      admin.from("proyecto_operadores").select("*, operadores(*)").eq("proyecto_id", proyecto_id),
      admin.from("activos").select("*").eq("proyecto_id", proyecto_id),
      admin.from("documentos_proyecto").select("*").eq("proyecto_id", proyecto_id),
      admin.from("negociaciones").select("*, operadores(nombre), contactos:contacto_interlocutor_id(nombre, empresa)").eq("proyecto_id", proyecto_id),
      admin.from("ai_learned_patterns").select("*").eq("activo", true).gte("confianza", 0.6).limit(50),
    ]);

    if (!proyecto) {
      if (taskRecord) {
        await admin.from("ai_agent_tasks").update({ estado: "failed", error_mensaje: "Proyecto no encontrado" }).eq("id", taskRecord.id);
      }
      return new Response(JSON.stringify({ error: "Proyecto no encontrado" }), { status: 404, headers: corsHeaders });
    }

    // Build comprehensive context
    const context = `PROYECTO: ${proyecto.nombre} (${proyecto.tipo}, estado: ${proyecto.estado})
Ubicación: ${proyecto.ubicacion || "N/A"} | Presupuesto: ${proyecto.presupuesto_estimado || "N/A"}€
Descripción: ${proyecto.descripcion || "Sin descripción"}

ACTIVOS VINCULADOS: ${activos?.length || 0}
${(activos || []).map((a: any) => `- ${a.nombre}: ${a.metros_cuadrados}m², renta esperada ${a.renta_esperada}€, estado ${a.estado}`).join("\n")}

OPERADORES EN PROYECTO: ${operadores?.length || 0}
${(operadores || []).map((o: any) => `- ${o.operadores?.nombre} (${o.operadores?.sector}), rol: ${o.rol}`).join("\n")}

MATCHES IA (top 10):
${(matches || []).slice(0, 10).map((m: any) => `- ${m.operadores?.nombre}: score ${m.score}%, estado ${m.estado}`).join("\n")}

NEGOCIACIONES: ${negociaciones?.length || 0}
${(negociaciones || []).map((n: any) => `- Op: ${n.operadores?.nombre}, estado: ${n.estado}, prob: ${n.probabilidad_cierre || "?"}`).join("\n")}

DOCUMENTOS: ${docs?.length || 0} (${docs?.filter((d: any) => d.procesado_ia).length || 0} indexados)

PATRONES APRENDIDOS RELEVANTES:
${(patterns || []).slice(0, 20).map((p: any) => `- ${p.patron_descripcion}: ajuste ${p.score_ajuste > 0 ? "+" : ""}${p.score_ajuste}, éxito ${Math.round(p.tasa_exito * 100)}%, obs: ${p.num_observaciones}`).join("\n")}`;

    // Call AI to generate insights
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `Eres un analista experto en retail inmobiliario comercial. Tu misión es analizar el estado de un proyecto y generar insights accionables: oportunidades no detectadas, riesgos, recomendaciones estratégicas, y anomalías. Cada insight debe ser específico, basado en datos, y tener una acción concreta sugerida. IMPORTANTE: Aprende de los patrones históricos proporcionados para hacer predicciones más precisas.`,
          },
          {
            role: "user",
            content: `Analiza este proyecto y genera insights accionables:\n\n${context}`,
          },
        ],
        tools: [{
          type: "function",
          function: {
            name: "generate_insights",
            description: "Generate actionable insights for the project",
            parameters: {
              type: "object",
              properties: {
                insights: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      tipo: { type: "string", enum: ["opportunity", "risk", "recommendation", "anomaly", "trend"] },
                      severidad: { type: "string", enum: ["info", "warning", "critical", "opportunity"] },
                      titulo: { type: "string", description: "Título conciso del insight" },
                      descripcion: { type: "string", description: "Descripción detallada con datos específicos" },
                      impacto_estimado: { type: "string", enum: ["alto", "medio", "bajo"] },
                      confianza: { type: "number", description: "0-1, confianza en el insight" },
                      acciones_sugeridas: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            accion: { type: "string" },
                            descripcion: { type: "string" },
                            impacto_estimado: { type: "string" },
                          },
                          required: ["accion", "descripcion"],
                        },
                      },
                      entidades_relacionadas: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            tipo: { type: "string" },
                            nombre: { type: "string" },
                          },
                          required: ["tipo", "nombre"],
                        },
                      },
                    },
                    required: ["tipo", "severidad", "titulo", "descripcion", "impacto_estimado", "confianza", "acciones_sugeridas"],
                  },
                },
              },
              required: ["insights"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      const errorMsg = aiResponse.status === 429 ? "Rate limit" : aiResponse.status === 402 ? "Credits exhausted" : errText;
      if (taskRecord) {
        await admin.from("ai_agent_tasks").update({ estado: "failed", error_mensaje: errorMsg }).eq("id", taskRecord.id);
      }
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: aiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    let insights: any[] = [];

    if (toolCall?.function?.arguments) {
      const parsed = JSON.parse(toolCall.function.arguments);
      insights = parsed.insights || [];
    }

    // Insert insights
    const insightInserts = insights.map((insight: any) => ({
      tipo: insight.tipo,
      severidad: insight.severidad,
      titulo: insight.titulo,
      descripcion: insight.descripcion,
      proyecto_id,
      entidades_relacionadas: insight.entidades_relacionadas || [],
      acciones_sugeridas: insight.acciones_sugeridas || [],
      confianza: insight.confianza,
      impacto_estimado: insight.impacto_estimado,
      generado_por_tarea_id: taskRecord?.id,
      modelo_usado: "gemini-2.5-pro",
    }));

    if (insightInserts.length > 0) {
      await admin.from("ai_insights").insert(insightInserts);
    }

    const latency = Date.now() - startTime;
    const tokensIn = aiData.usage?.prompt_tokens || 0;
    const tokensOut = aiData.usage?.completion_tokens || 0;

    // Update task record
    if (taskRecord) {
      await admin.from("ai_agent_tasks").update({
        estado: "completed",
        completado_en: new Date().toISOString(),
        resultado: { insights_count: insights.length },
        insights_generados: insights,
        modelo_usado: "gemini-2.5-pro",
        tokens_consumidos: tokensIn + tokensOut,
        coste_estimado: tokensIn * 0.00001 + tokensOut * 0.00004,
      }).eq("id", taskRecord.id);
    }

    // Audit log
    await admin.from("auditoria_ia").insert({
      modelo: "gemini-2.5-pro",
      funcion_ia: "background_agent_" + agent_type,
      tokens_entrada: tokensIn,
      tokens_salida: tokensOut,
      coste_estimado: tokensIn * 0.00001 + tokensOut * 0.00004,
      latencia_ms: latency,
      exito: true,
      created_by: claims.user.id,
    });

    return new Response(JSON.stringify({
      insights,
      insights_count: insights.length,
      task_id: taskRecord?.id,
      latency_ms: latency,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Background agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
