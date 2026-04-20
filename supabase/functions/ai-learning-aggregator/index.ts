import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * AI Learning Aggregator Agent
 * Processes feedback and updates learned patterns to improve AI predictions
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const startTime = Date.now();

    // Fetch pending learning tasks
    const { data: tasks, error: taskError } = await admin
      .from("ai_agent_tasks")
      .select("*")
      .eq("agente_tipo", "learning_aggregator")
      .eq("estado", "pending")
      .order("prioridad", { ascending: false })
      .limit(200);

    if (taskError || !tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No pending tasks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processedCount = 0;
    let patternsUpdated = 0;

    for (const task of tasks) {
      try {
        // Mark as processing
        await admin.from("ai_agent_tasks").update({
          estado: "processing",
          iniciado_en: new Date().toISOString(),
          intentos: task.intentos + 1,
        }).eq("id", task.id);

        // Process based on entity type
        if (task.entidad_tipo === "match") {
          patternsUpdated += await processMatchFeedback(admin, task.entidad_id);
        } else if (task.entidad_tipo === "rag_response") {
          patternsUpdated += await processRAGFeedback(admin, task.entidad_id);
        } else if (task.entidad_tipo === "ava_message") {
          patternsUpdated += await processAvaMessageFeedback(admin, task.entidad_id);
        }

        // Mark as completed
        await admin.from("ai_agent_tasks").update({
          estado: "completed",
          completado_en: new Date().toISOString(),
          resultado: { patterns_updated: patternsUpdated },
        }).eq("id", task.id);

        processedCount++;
      } catch (e) {
        console.error(`Task ${task.id} failed:`, e);
        await admin.from("ai_agent_tasks").update({
          estado: task.intentos >= task.max_intentos ? "failed" : "pending",
          error_mensaje: e instanceof Error ? e.message : "Unknown error",
        }).eq("id", task.id);
      }
    }

    // Aggregate sector patterns periodically (lowered threshold)
    if (processedCount >= 3) {
      try { await aggregateMatchPatterns(admin); } catch (e) { console.warn("aggregateMatchPatterns:", e); }
    }

    return new Response(JSON.stringify({
      processed: processedCount,
      patterns_updated: patternsUpdated,
      latency_ms: Date.now() - startTime,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("Learning aggregator error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Process match feedback and update sector/range patterns
 */
async function processMatchFeedback(admin: any, matchId: string): Promise<number> {
  // Get feedback for this match
  const { data: feedback } = await admin
    .from("ai_feedback")
    .select("*")
    .eq("entidad_tipo", "match")
    .eq("entidad_id", matchId);

  if (!feedback || feedback.length === 0) return 0;

  // Get match details
  const { data: match } = await admin
    .from("matches")
    .select("*, locales(*), operadores(*)")
    .eq("id", matchId)
    .single();

  if (!match) return 0;

  const local = match.locales;
  const operador = match.operadores;
  if (!local || !operador) return 0;

  let patternsUpdated = 0;

  // Calculate feedback signals
  const selections = feedback.filter((f: any) => f.seleccionado).length;
  const thumbsUp = feedback.filter((f: any) => f.feedback_tipo === "thumbs_up").length;
  const thumbsDown = feedback.filter((f: any) => f.feedback_tipo === "thumbs_down").length;
  const isPositive = selections > 0 || thumbsUp > thumbsDown;

  // Pattern 1: Sector + Surface Range
  const surfaceRange = getSurfaceRange(local.superficie_m2);
  const sectorSurfaceKey = `sector:${operador.sector.toLowerCase()}+superficie:${surfaceRange}`;
  patternsUpdated += await updatePattern(admin, {
    patron_tipo: "match_preference",
    patron_key: sectorSurfaceKey,
    patron_descripcion: `${operador.sector} en espacios ${surfaceRange}m²`,
    isPositive,
    matchScore: match.score,
  });

  // Pattern 2: Sector + Budget Range
  const budgetRange = getBudgetRange(local.precio_renta);
  const sectorBudgetKey = `sector:${operador.sector.toLowerCase()}+presupuesto:${budgetRange}`;
  patternsUpdated += await updatePattern(admin, {
    patron_tipo: "budget_flexibility",
    patron_key: sectorBudgetKey,
    patron_descripcion: `${operador.sector} con renta ${budgetRange}€`,
    isPositive,
    matchScore: match.score,
  });

  // Pattern 3: Zone (if available)
  if (local.ciudad) {
    const zoneKey = `zona:${local.ciudad.toLowerCase()}+sector:${operador.sector.toLowerCase()}`;
    patternsUpdated += await updatePattern(admin, {
      patron_tipo: "sector_affinity",
      patron_key: zoneKey,
      patron_descripcion: `${operador.sector} en ${local.ciudad}`,
      isPositive,
      matchScore: match.score,
    });
  }

  return patternsUpdated;
}

/**
 * Process RAG response feedback
 */
async function processRAGFeedback(admin: any, responseId: string): Promise<number> {
  const { data: feedback } = await admin
    .from("ai_feedback")
    .select("*")
    .eq("entidad_tipo", "rag_response")
    .eq("entidad_id", responseId);

  if (!feedback || feedback.length === 0) return 0;

  const avgRating = feedback
    .filter((f: any) => f.rating != null)
    .reduce((sum: number, f: any) => sum + f.rating, 0) / feedback.length;

  const corrections = feedback.filter((f: any) => f.correccion_sugerida).length;

  // Update document relevance patterns
  const contexto = feedback[0]?.contexto || {};
  if (contexto.dominio) {
    await updatePattern(admin, {
      patron_tipo: "document_relevance",
      patron_key: `dominio:${contexto.dominio}`,
      patron_descripcion: `Relevancia en dominio ${contexto.dominio}`,
      isPositive: avgRating >= 3.5 && corrections === 0,
      matchScore: avgRating * 20,
    });
    return 1;
  }

  return 0;
}

/**
 * Update or create a learned pattern
 */
async function updatePattern(admin: any, params: {
  patron_tipo: string;
  patron_key: string;
  patron_descripcion: string;
  isPositive: boolean;
  matchScore: number;
}): Promise<number> {
  const { patron_tipo, patron_key, patron_descripcion, isPositive, matchScore } = params;

  // Check if pattern exists
  const { data: existing } = await admin
    .from("ai_learned_patterns")
    .select("*")
    .eq("patron_tipo", patron_tipo)
    .eq("patron_key", patron_key)
    .single();

  const scoreAdjust = isPositive ? 2 : -1;
  const newExample = {
    timestamp: new Date().toISOString(),
    score: matchScore,
    result: isPositive ? "success" : "failure",
  };

  if (existing) {
    const newObservations = existing.num_observaciones + 1;
    const newTasaExito = isPositive
      ? (existing.tasa_exito * existing.num_observaciones + 1) / newObservations
      : (existing.tasa_exito * existing.num_observaciones) / newObservations;

    const ejemplos = [...(existing.ejemplos_recientes || []), newExample].slice(-10);

    await admin.from("ai_learned_patterns").update({
      score_ajuste: Math.max(-20, Math.min(20, existing.score_ajuste + scoreAdjust)),
      confianza: Math.min(0.95, existing.confianza + 0.02),
      num_observaciones: newObservations,
      tasa_exito: newTasaExito,
      ejemplos_recientes: ejemplos,
      updated_at: new Date().toISOString(),
    }).eq("id", existing.id);
  } else {
    await admin.from("ai_learned_patterns").insert({
      patron_tipo,
      patron_key,
      patron_descripcion,
      score_ajuste: scoreAdjust,
      confianza: 0.55,
      num_observaciones: 1,
      tasa_exito: isPositive ? 1 : 0,
      ejemplos_recientes: [newExample],
    });
  }

  return 1;
}

/**
 * Aggregate patterns into match predictions
 */
async function aggregateMatchPatterns(admin: any) {
  // Get recent successful matches for comparison
  const { data: successfulMatches } = await admin
    .from("matches")
    .select("*, locales(*), operadores(*)")
    .eq("estado", "exito")
    .order("updated_at", { ascending: false })
    .limit(100);

  if (!successfulMatches || successfulMatches.length < 10) return;

  // Update aggregate statistics
  const sectorStats: Record<string, { total: number; success: number; avgScore: number }> = {};

  for (const match of successfulMatches) {
    const sector = match.operadores?.sector?.toLowerCase() || "unknown";
    if (!sectorStats[sector]) {
      sectorStats[sector] = { total: 0, success: 0, avgScore: 0 };
    }
    sectorStats[sector].total++;
    sectorStats[sector].success++;
    sectorStats[sector].avgScore += match.score;
  }

  // Update sector patterns
  for (const [sector, stats] of Object.entries(sectorStats)) {
    await admin.from("ai_learned_patterns").upsert({
      patron_tipo: "sector_success_rate",
      patron_key: `sector:${sector}`,
      patron_descripcion: `Tasa de éxito del sector ${sector}`,
      tasa_exito: stats.success / stats.total,
      num_observaciones: stats.total,
      datos_agregados: {
        avg_score: stats.avgScore / stats.total,
        total_matches: stats.total,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: "patron_tipo,patron_key" });
  }
}

function getSurfaceRange(m2: number): string {
  if (m2 < 50) return "0-50";
  if (m2 < 100) return "50-100";
  if (m2 < 200) return "100-200";
  if (m2 < 500) return "200-500";
  return "500+";
}

function getBudgetRange(rent: number): string {
  if (rent < 1000) return "0-1000";
  if (rent < 3000) return "1000-3000";
  if (rent < 5000) return "3000-5000";
  if (rent < 10000) return "5000-10000";
  return "10000+";
}

/**
 * Process feedback on AVA chat messages.
 * Extracts topic from tools used or message content, then learns success/failure patterns.
 */
async function processAvaMessageFeedback(admin: any, messageId: string): Promise<number> {
  // Get all feedback for this message
  const { data: feedback } = await admin
    .from("ai_feedback")
    .select("*")
    .eq("entidad_tipo", "ava_message")
    .eq("entidad_id", messageId);

  if (!feedback || feedback.length === 0) return 0;

  // Get the AVA message itself for topic inference
  const { data: msg } = await admin
    .from("ava_messages")
    .select("content, meta, conversation_id")
    .eq("id", messageId)
    .maybeSingle();

  // Get the previous user message in the conversation (the question that led to this answer)
  let userQuestion = "";
  if (msg?.conversation_id) {
    const { data: prevMsgs } = await admin
      .from("ava_messages")
      .select("role, content, created_at")
      .eq("conversation_id", msg.conversation_id)
      .order("created_at", { ascending: false })
      .limit(10);
    const idx = (prevMsgs || []).findIndex((m: any) => m.content === msg.content);
    const userMsg = (prevMsgs || []).slice(idx + 1).find((m: any) => m.role === "user");
    userQuestion = userMsg?.content || "";
  }

  const toolsUsed: string[] = (msg?.meta?.tools_used || feedback[0]?.contexto?.tools_used || []) as string[];
  const topic = inferTopic(userQuestion, toolsUsed);

  let patternsUpdated = 0;

  for (const fb of feedback) {
    const isPositive = fb.feedback_tipo === "thumbs_up";
    const isNegative = fb.feedback_tipo === "thumbs_down" || fb.feedback_tipo === "correction";
    const correction = (fb.correccion_sugerida || "").toString().slice(0, 500);

    if (!isPositive && !isNegative) continue;

    // Pattern 1: topic-level (positive or negative reinforcement)
    patternsUpdated += await updatePattern(admin, {
      patron_tipo: "ava_topic",
      patron_key: `topic:${topic}`,
      patron_descripcion: `Respuestas sobre "${topic}"`,
      isPositive,
      matchScore: isPositive ? 80 : 20,
    });

    // Pattern 2: explicit correction stored as actionable lesson
    if (correction) {
      const correctionKey = `correction:${topic}:${hashShort(correction)}`;
      await admin.from("ai_learned_patterns").upsert({
        patron_tipo: "ava_correction",
        patron_key: correctionKey,
        patron_descripcion: `Sobre "${topic}": ${correction}`,
        score_ajuste: -3,
        confianza: 0.75,
        num_observaciones: 1,
        tasa_exito: 0,
        ejemplos_recientes: [{
          timestamp: new Date().toISOString(),
          user_question: userQuestion.slice(0, 300),
          correction,
        }],
        updated_at: new Date().toISOString(),
        activo: true,
      }, { onConflict: "patron_tipo,patron_key" });
      patternsUpdated++;
    }

    // Pattern 3: tools combination effectiveness
    if (toolsUsed.length > 0) {
      const toolKey = toolsUsed.map(t => t.split(":")[0]).sort().join("+");
      patternsUpdated += await updatePattern(admin, {
        patron_tipo: "ava_tool_combo",
        patron_key: `tools:${toolKey}`,
        patron_descripcion: `Combinación de herramientas: ${toolKey}`,
        isPositive,
        matchScore: isPositive ? 75 : 25,
      });
    }
  }

  return patternsUpdated;
}

function inferTopic(userQuestion: string, toolsUsed: string[]): string {
  const q = (userQuestion || "").toLowerCase();
  // Keyword matching
  if (/centro comercial|cc |mall|parque comercial|tenant mix|sba|gla/i.test(q)) return "centro_comercial";
  if (/operador|marca|expansi[óo]n|inquilino/i.test(q)) return "operador";
  if (/local|activo|inmueble|nave|parcela/i.test(q)) return "activo";
  if (/contrato|cl[áa]usula|renta|alquiler/i.test(q)) return "contrato";
  if (/negocia|propuesta|carta de intenci/i.test(q)) return "negociacion";
  if (/match|compatibil|encaja/i.test(q)) return "matching";
  if (/informe|dossier|pdf|reporte/i.test(q)) return "informe";
  if (/contacto|persona|interlocutor/i.test(q)) return "contacto";
  // Fallback to dominant tool
  if (toolsUsed.some(t => t.startsWith("nearby_search"))) return "ubicacion";
  if (toolsUsed.some(t => t.startsWith("rag_search"))) return "documental";
  if (toolsUsed.some(t => t.startsWith("db_query"))) return "base_datos";
  // Last resort: first 3 significant words
  const words = q.split(/\s+/).filter(w => w.length > 4).slice(0, 3).join("_");
  return words || "general";
}

function hashShort(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}
