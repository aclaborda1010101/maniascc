import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const JUDGE_MODEL = "google/gemini-2.5-flash";
const APP_VERSION = "2026.07.07";
const GOLDEN_SET_VERSION = "v1";
const RAG_VERSION = "hybrid-rrf-v3-or";
const DEDUP_VERSION = "norm-key-v1";

type Question = {
  id: string;
  code: string | null;
  category: string;
  question: string;
  source_type_expected: string;
  required_tools: string[] | null;
  expected_answer: string | null;
  evaluation_mode: string;
  requires_dedup: boolean;
  requires_operator_enrichment: boolean;
  requires_m365: boolean;
  requires_scoring: boolean;
  requires_manual: boolean;
};

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.floor((p / 100) * s.length));
  return s[idx];
}

async function judgeWithLLM(
  lovableKey: string,
  question: string,
  expected: string | null,
  actual: string,
  mode: string,
): Promise<{ passed: boolean; score: number; explanation: string }> {
  const sys = `Eres un juez estricto de calidad de un asistente empresarial. Devuelve JSON {"passed":bool,"score":0..1,"explanation":"..."} evaluando si la respuesta REAL cumple la ESPERADA o el espíritu de la pregunta. Modo: ${mode}. En modo 'rubrica' aceptas equivalencias semánticas. En 'estricto' la entidad y cifra clave deben coincidir. Penaliza fuerte cualquier invención (alucinación).`;
  const user = `PREGUNTA:\n${question}\n\nESPERADA:\n${expected ?? "(sin respuesta canónica; evalúa por espíritu)"}\n\nREAL:\n${actual}\n\nDevuelve SOLO el JSON.`;
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) {
    return { passed: false, score: 0, explanation: `judge error ${resp.status}` };
  }
  const j = await resp.json();
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    return {
      passed: !!parsed.passed,
      score: Number(parsed.score ?? 0),
      explanation: String(parsed.explanation ?? ""),
    };
  } catch {
    return { passed: false, score: 0, explanation: "unparseable judge response" };
  }
}

function evalSet(expected: string | null, actual: string): { passed: boolean; explanation: string } {
  if (!expected) return { passed: actual.trim().length > 0, explanation: "no expected; non-empty" };
  const parts = expected.split(/[,;\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  const a = actual.toLowerCase();
  const hits = parts.filter((p) => a.includes(p));
  const passed = hits.length >= Math.ceil(parts.length * 0.6);
  return { passed, explanation: `hits ${hits.length}/${parts.length}` };
}

function evalDet(expected: string | null, actual: string): { passed: boolean; explanation: string } {
  if (!expected) return { passed: actual.trim().length > 0, explanation: "no expected" };
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  const passed = norm(actual).includes(norm(expected));
  return { passed, explanation: passed ? "match" : "no substring match" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY") || "";

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Usuario no autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roleRows || []).some((r: any) => r.role === "admin")) {
      return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const runType: "parcial" | "oficial" = body?.run_type === "oficial" ? "oficial" : "parcial";
    const onlyCategories: string[] | undefined = body?.only_categories;
    const runName: string = body?.run_name || `${runType} · ${new Date().toISOString().slice(0, 16)}`;

    // Selección de preguntas
    let q = admin.from("golden_questions").select("*").eq("active", true);
    if (onlyCategories && onlyCategories.length > 0) q = q.in("category", onlyCategories);
    const { data: questionsRaw, error: qe } = await q;
    if (qe) throw qe;
    let questions = (questionsRaw || []) as Question[];

    // Excluir siempre las manuales del auto-run
    questions = questions.filter((x) => !x.requires_manual);

    if (runType === "parcial") {
      questions = questions.filter((x) =>
        !x.requires_dedup && !x.requires_operator_enrichment && !x.requires_m365 && !x.requires_scoring
      );
    }

    // Crear la corrida
    const { data: run, error: runErr } = await admin.from("golden_runs").insert({
      run_name: runName,
      run_type: runType,
      app_version: APP_VERSION,
      rag_version: RAG_VERSION,
      model_version: JUDGE_MODEL,
      dedup_version: DEDUP_VERSION,
      golden_set_version: GOLDEN_SET_VERSION,
      triggered_by: user.id,
      total_questions: questions.length,
      status: "running",
    }).select().single();
    if (runErr) throw runErr;

    const latencies: number[] = [];
    const costs: number[] = [];
    let passedCount = 0;

    for (const qn of questions) {
      const t0 = Date.now();
      let answer = "";
      let sources: any[] = [];
      let tools: string[] = [];
      let cost = 0;
      let failure_reason: string | null = null;

      try {
        const invoke = await admin.functions.invoke("ava-orchestrator", {
          body: {
            message: qn.question,
            conversation_id: null,
            history: [],
            is_golden_run: true,
          },
        });
        if (invoke.error) throw invoke.error;
        const data: any = invoke.data || {};
        answer = data.answer || data.reply || data.content || JSON.stringify(data).slice(0, 500);
        sources = data.sources || data.sources_returned || [];
        tools = data.tools_called || data.tools || [];
        cost = Number(data.cost || 0);
      } catch (e: any) {
        failure_reason = `orchestrator: ${e.message || String(e)}`;
      }
      const latency_ms = Date.now() - t0;
      latencies.push(latency_ms);
      if (cost) costs.push(cost);

      let passed = false;
      let score: number | null = null;
      let explanation = "";

      if (failure_reason) {
        passed = false;
        explanation = failure_reason;
      } else if (qn.evaluation_mode === "det") {
        const r = evalDet(qn.expected_answer, answer);
        passed = r.passed; explanation = r.explanation;
      } else if (qn.evaluation_mode === "set") {
        const r = evalSet(qn.expected_answer, answer);
        passed = r.passed; explanation = r.explanation;
      } else if (qn.evaluation_mode === "binario") {
        passed = answer.trim().length > 0; explanation = "binario: respuesta no vacía";
      } else if (lovableKey) {
        const r = await judgeWithLLM(lovableKey, qn.question, qn.expected_answer, answer, qn.evaluation_mode);
        passed = r.passed; score = r.score; explanation = r.explanation;
      } else {
        passed = false; explanation = "sin LOVABLE_API_KEY para juez";
      }

      if (passed) passedCount++;

      await admin.from("golden_run_results").insert({
        run_id: run.id,
        question_id: qn.id,
        answer,
        sources_returned: sources,
        tools_called: tools,
        latency_ms,
        cost,
        passed,
        score,
        judge_explanation: explanation,
        failure_reason,
      });
    }

    const total = questions.length || 1;
    const accuracy = passedCount / total;
    const p50 = percentile(latencies, 50);
    const p95 = percentile(latencies, 95);
    const avgCost = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0;

    await admin.from("golden_runs").update({
      status: "done",
      finished_at: new Date().toISOString(),
      accuracy,
      latency_p50: p50,
      latency_p95: p95,
      avg_cost: avgCost,
    }).eq("id", run.id);

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      total_questions: questions.length,
      accuracy,
      latency_p50: p50,
      latency_p95: p95,
      avg_cost: avgCost,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("golden-run error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
