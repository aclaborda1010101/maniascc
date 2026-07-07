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

    const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isServiceCall = bearer === serviceKey;

    const admin = createClient(supabaseUrl, serviceKey);
    let triggeredBy: string | null = null;

    if (!isServiceCall) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) return new Response(JSON.stringify({ error: "Usuario no autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: roleRows } = await admin.from("user_roles").select("role").eq("user_id", user.id);
      if (!(roleRows || []).some((r: any) => r.role === "admin")) {
        return new Response(JSON.stringify({ error: "Solo administradores" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      triggeredBy = user.id;
    }

    const body = await req.json().catch(() => ({}));
    const runType: "parcial" | "oficial" = body?.run_type === "oficial" ? "oficial" : "parcial";
    const onlyCategories: string[] | undefined = body?.only_categories;
    const runName: string = body?.run_name || `${runType} · ${new Date().toISOString().slice(0, 16)}`;
    const runnerEmail: string | undefined = body?.runner_email;
    const runnerPassword: string | undefined = body?.runner_password;

    // Obtener JWT del runner (usuario real) para llamar al orquestador con getUser válido
    let runnerJwt = isServiceCall ? "" : authHeader.replace(/^Bearer\s+/i, "").trim();
    if (runnerEmail && runnerPassword) {
      const anon = createClient(supabaseUrl, anonKey);
      const { data: sess, error: signErr } = await anon.auth.signInWithPassword({ email: runnerEmail, password: runnerPassword });
      if (signErr || !sess?.session?.access_token) {
        return new Response(JSON.stringify({ error: `runner sign-in falló: ${signErr?.message || "sin sesión"}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      runnerJwt = sess.session.access_token;
    }
    if (!runnerJwt) {
      return new Response(JSON.stringify({ error: "Falta runner_jwt (proporcione runner_email+runner_password o llame con JWT de usuario)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Selección de preguntas
    let q = admin.from("golden_questions").select("*").eq("active", true);
    if (onlyCategories && onlyCategories.length > 0) q = q.in("category", onlyCategories);
    const { data: questionsRaw, error: qe } = await q;
    if (qe) throw qe;
    let questions = (questionsRaw || []) as Question[];

    questions = questions.filter((x) => !x.requires_manual);
    if (runType === "parcial") {
      questions = questions.filter((x) =>
        !x.requires_dedup && !x.requires_operator_enrichment && !x.requires_m365 && !x.requires_scoring
      );
    }

    const { data: run, error: runErr } = await admin.from("golden_runs").insert({
      run_name: runName,
      run_type: runType,
      app_version: APP_VERSION,
      rag_version: RAG_VERSION,
      model_version: JUDGE_MODEL,
      dedup_version: DEDUP_VERSION,
      golden_set_version: GOLDEN_SET_VERSION,
      database_snapshot_at: new Date().toISOString(),
      triggered_by: triggeredBy,
      total_questions: questions.length,
      status: "running",
    }).select().single();
    if (runErr) throw runErr;

    // Background worker: procesa todas las preguntas sin bloquear la respuesta
    const worker = async () => {
      const latencies: number[] = [];
      const costs: number[] = [];
      let passedCount = 0;
      let hallucTotal = 0, hallucFail = 0;
      let ragTotal = 0, ragWithSourcesPassed = 0;
      let routeTotal = 0, routePassed = 0;
      const orchestratorUrl = `${supabaseUrl}/functions/v1/ava-orchestrator`;

      for (const qn of questions) {
        const t0 = Date.now();
        let answer = "";
        let sources: any[] = [];
        let tools: string[] = [];
        let cost = 0;
        let failure_reason: string | null = null;

        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 120_000);
          const r = await fetch(orchestratorUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${runnerJwt}`,
              "apikey": anonKey,
            },
            body: JSON.stringify({
              message: qn.question,
              conversation_id: null,
              history: [],
              is_golden_run: true,
            }),
            signal: ctrl.signal,
          });
          clearTimeout(to);
          const txt = await r.text();
          if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
          let data: any = {};
          try { data = JSON.parse(txt); } catch { data = { answer: txt }; }
          answer = data.answer || data.reply || data.content || data.message || (typeof data === "string" ? data : JSON.stringify(data).slice(0, 500));
          sources = data.sources || data.sources_returned || data.citations || [];
          if (Array.isArray(data.tools_called)) tools = data.tools_called;
          else if (data.route) tools = [String(data.route)];
          cost = Number(data.cost || data.total_cost || 0);
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
          passed = false; explanation = failure_reason;
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

        const cat = (qn.category || "").toLowerCase();
        const code = (qn.code || "").toUpperCase();
        if ((cat.includes("no") && cat.includes("inven")) || code.startsWith("G")) {
          hallucTotal++; if (!passed) hallucFail++;
        }
        if (qn.source_type_expected === "RAG" || cat === "rag") {
          ragTotal++;
          if (passed && Array.isArray(sources) && sources.length > 0) ragWithSourcesPassed++;
        }
        if (cat.includes("router") || cat.includes("rendim") || code.startsWith("I")) {
          routeTotal++; if (passed) routePassed++;
        }

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
      await admin.from("golden_runs").update({
        status: "done",
        finished_at: new Date().toISOString(),
        accuracy: passedCount / total,
        latency_p50: percentile(latencies, 50),
        latency_p95: percentile(latencies, 95),
        avg_cost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
        hallucination_rate: hallucTotal > 0 ? hallucFail / hallucTotal : null,
        source_precision: ragTotal > 0 ? ragWithSourcesPassed / ragTotal : null,
        route_accuracy: routeTotal > 0 ? routePassed / routeTotal : null,
      }).eq("id", run.id);
    };

    // @ts-ignore EdgeRuntime is provided por Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(worker().catch(async (e) => {
        await admin.from("golden_runs").update({ status: "error", notes: String(e?.message || e) }).eq("id", run.id);
      }));
    } else {
      worker().catch(() => {});
    }

    return new Response(JSON.stringify({
      success: true,
      run_id: run.id,
      total_questions: questions.length,
      status: "running",
      message: "Corrida lanzada en background. Consulta golden_runs / golden_run_results para el progreso.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("golden-run error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

