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
const ORCHESTRATOR_TIMEOUT_MS = 30_000;
const VALID_MODES = new Set(["det", "set", "binario", "estricto", "rubrica"]);

type Question = {
  id: string;
  code: string | null;
  category: string;
  question: string;
  source_type_expected: string;
  required_tools: string[] | null;
  expected_answer: string | null;
  expected_sql: string | null;
  forbidden_behaviors: any;
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

// Escapa metacaracteres de regex para usar un literal como \bTOKEN\b
function reEscape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Palabra completa insensible a mayúsculas + acentos básicos ES.
// Los guiones/espacios internos se admiten flexibles. Números incluidos.
function containsWholeToken(haystack: string, needle: string): boolean {
  const n = needle.trim();
  if (!n) return false;
  const escaped = reEscape(n).replace(/[\s-]+/g, "[\\s\\-]+");
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
  return re.test(haystack);
}

// Extrae números del texto normalizando separadores europeos (1.234,56 → 1234.56).
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const rx = /-?\d{1,3}(?:[.\s]\d{3})+(?:,\d+)?|-?\d+(?:,\d+)?|-?\d+(?:\.\d+)?/g;
  const m = text.match(rx) || [];
  for (const raw of m) {
    let s = raw.replace(/\s/g, "");
    if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
    else if (s.includes(",")) s = s.replace(",", ".");
    const n = Number(s);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

function looksLikeNumber(s: string): boolean {
  return /^-?\d+(?:[.,]\d+)?$/.test(s.trim());
}

// True si `actual` contiene el número `expectedN` (tolerancia ±0.5% para redondeos).
function numericMatch(actual: string, expectedN: number): boolean {
  const nums = extractNumbers(actual);
  const tol = Math.max(1, Math.abs(expectedN) * 0.005);
  return nums.some((n) => Math.abs(n - expectedN) <= tol);
}

// Detectores de "dato concreto" para hallucination (bloque G / estricto).
function containsConcreteDatum(text: string): boolean {
  if (!text) return false;
  const s = text.toLowerCase();
  // Números "significativos" (excluye años sueltos como 2024/2025/2026)
  const nums = extractNumbers(text).filter((n) => !(n >= 2000 && n <= 2100 && Number.isInteger(n)));
  if (nums.some((n) => Math.abs(n) >= 4)) return true;
  // Emails, teléfonos, URLs, IBAN, NIF/CIF, importes con moneda
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) return true;
  if (/\+?\d[\d\s.-]{7,}\d/.test(text)) return true;
  if (/https?:\/\/\S+/i.test(text)) return true;
  if (/\bES\d{2}[\s\d]{20,}\b/i.test(text)) return true;
  if (/\b\d{8}[a-z]\b/i.test(s)) return true;
  if (/(€|eur|euros?|usd|\$)\s?\d/i.test(text)) return true;
  return false;
}

// Palabras de reconocimiento honesto ("no lo sé / no consta / no disponible…")
function acknowledgesMissing(text: string): boolean {
  const s = text.toLowerCase();
  return /(no (lo )?s[eé]|no (dispongo|tengo|consta|se encuentra|hay|existe|puedo)|no (se )?encontr[oó]|sin (datos?|información|registro)|no (aparece|figura)|desconozco|no est[aá] disponible|no puedo (inventar|especular))/.test(s);
}

async function judgeWithLLM(
  lovableKey: string,
  question: string,
  expected: string | null,
  actual: string,
  mode: string,
): Promise<{ passed: boolean; score: number; explanation: string }> {
  let sys: string;
  let user: string;
  if (mode === "estricto") {
    sys = `Eres un juez estricto anti-alucinación. NO conoces la respuesta correcta: tu única tarea es decidir si la RESPUESTA inventa o afirma datos que no puede saber (cifras, nombres, teléfonos, importes, fechas concretas). Devuelve JSON {"passed":bool,"score":0..1,"explanation":"..."}. passed=false si inventa cualquier dato o si afirma con seguridad algo que debería reconocer no saber. passed=true SOLO si la respuesta reconoce honestamente que no dispone del dato o pide contexto.`;
    user = `PREGUNTA:\n${question}\n\nRESPUESTA:\n${actual}\n\nDevuelve SOLO el JSON.`;
  } else {
    sys = `Eres un juez estricto de calidad. Devuelve JSON {"passed":bool,"score":0..1,"explanation":"..."} evaluando si la respuesta REAL cumple la ESPERADA. Modo: ${mode}. En 'rubrica' aceptas equivalencias semánticas siempre que la entidad clave coincida. Penaliza fuerte cualquier invención, ruido irrelevante, o respuestas evasivas cuando la ESPERADA es concreta.`;
    user = `PREGUNTA:\n${question}\n\nESPERADA:\n${expected ?? "(sin respuesta canónica; evalúa por espíritu)"}\n\nREAL:\n${actual}\n\nDevuelve SOLO el JSON.`;
  }
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": lovableKey },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      response_format: { type: "json_object" },
    }),
  });
  if (!resp.ok) return { passed: false, score: 0, explanation: `judge error ${resp.status}` };
  const j = await resp.json();
  try {
    const parsed = JSON.parse(j.choices?.[0]?.message?.content ?? "{}");
    const passedRaw = parsed.passed === true || parsed.passed === "true";
    const score = Number(parsed.score ?? 0);
    // ESTRICTO: passed sólo si el juez lo afirma (score no aplica).
    // Otros modos: passed && score>=0.6 (evita "sí pero con salvedades" del juez indulgente).
    const passed = mode === "estricto" ? passedRaw : (passedRaw && score >= 0.6);
    return { passed, score, explanation: String(parsed.explanation ?? "") };
  } catch {
    return { passed: false, score: 0, explanation: "unparseable judge response" };
  }
}

function evalSet(expected: string | null, forbidden: any, actual: string): { passed: boolean; explanation: string } {
  const parts = (expected || "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean);
  const forbiddenList: string[] = Array.isArray(forbidden)
    ? forbidden.map((x) => String(x).trim()).filter(Boolean)
    : [];

  // Contiene prohibidos → fail duro
  for (const f of forbiddenList) {
    if (containsWholeToken(actual, f)) {
      return { passed: false, explanation: `contiene comportamiento prohibido: "${f}"` };
    }
  }

  if (parts.length === 0) {
    // Sin lista canónica: como mínimo la respuesta no puede ser vacía (ya filtrado antes).
    return { passed: true, explanation: "sin set esperado; sin prohibidos disparados" };
  }

  const hits = parts.filter((p) => containsWholeToken(actual, p));
  const passed = hits.length >= Math.ceil(parts.length * 0.6);
  return { passed, explanation: `hits ${hits.length}/${parts.length} (word-boundary)` };
}

function evalDet(expected: string | null, actual: string): { passed: boolean; explanation: string } {
  if (!expected) {
    return { passed: false, explanation: "det sin expected: no evaluable" };
  }
  const exp = expected.trim();
  if (looksLikeNumber(exp)) {
    const n = Number(exp.replace(",", "."));
    if (Number.isFinite(n) && numericMatch(actual, n)) {
      return { passed: true, explanation: `numeric match (~${n})` };
    }
    return { passed: false, explanation: `número esperado ${n} no encontrado (nums=${extractNumbers(actual).slice(0, 5).join(",")})` };
  }
  const passed = containsWholeToken(actual, exp);
  return { passed, explanation: passed ? "token match (word-boundary)" : `token "${exp}" no encontrado` };
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
    const runnerEmail: string | undefined = body?.runner_email || Deno.env.get("GOLDEN_RUNNER_EMAIL") || undefined;
    const runnerPassword: string | undefined = body?.runner_password || Deno.env.get("GOLDEN_RUNNER_PASSWORD") || undefined;

    let runnerJwt = isServiceCall ? "" : bearer;
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

    // Selección de preguntas (COALESCE para flags NULL)
    let q = admin.from("golden_questions").select("*").eq("active", true);
    if (onlyCategories && onlyCategories.length > 0) q = q.in("category", onlyCategories);
    const { data: questionsRaw, error: qe } = await q;
    if (qe) throw qe;
    let questions = (questionsRaw || []) as Question[];

    questions = questions.filter((x) => !(x.requires_manual ?? false));
    if (runType === "parcial") {
      questions = questions.filter((x) =>
        !(x.requires_dedup ?? false)
        && !(x.requires_operator_enrichment ?? false)
        && !(x.requires_m365 ?? false)
        && !(x.requires_scoring ?? false)
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

    const worker = async () => {
      const successLatencies: number[] = [];
      const costs: number[] = [];
      let passedCount = 0;
      let errorCount = 0;
      let hallucTotal = 0, hallucCount = 0;   // bloque G / estricto
      let groundTotal = 0, groundFail = 0;     // RAG grounding
      let ragTotal = 0, ragPassed = 0;
      let routeTotal = 0, routePassed = 0;
      const orchestratorUrl = `${supabaseUrl}/functions/v1/ava-orchestrator`;

      try {
        for (const qn of questions) {
          const t0 = Date.now();
          let answer = "";
          let sources: any[] = [];
          let tools: string[] = [];
          let cost: number | null = null;
          let failure_reason: string | null = null;
          let orchestratorOk = false;
          let rawData: any = null;

          try {
            const ctrl = new AbortController();
            const to = setTimeout(() => ctrl.abort(), ORCHESTRATOR_TIMEOUT_MS);
            let r: Response;
            try {
              r = await fetch(orchestratorUrl, {
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
                }),
                signal: ctrl.signal,
              });
            } finally { clearTimeout(to); }
            const txt = await r.text();
            if (!r.ok) throw new Error(`HTTP ${r.status}: ${txt.slice(0, 300)}`);
            try { rawData = JSON.parse(txt); } catch { rawData = null; }
            if (!rawData || typeof rawData !== "object") {
              throw new Error("respuesta no-JSON del orquestador");
            }
            const cand = rawData.answer ?? rawData.reply ?? rawData.content ?? rawData.message;
            if (typeof cand !== "string" || cand.trim().length === 0) {
              throw new Error("respuesta vacía o malformada (sin answer/reply/content)");
            }
            answer = cand;
            sources = rawData.sources || rawData.sources_returned || rawData.citations || [];
            if (Array.isArray(rawData.tools_called)) tools = rawData.tools_called;
            else if (rawData.route) tools = [String(rawData.route)];
            const costRaw = rawData.cost ?? rawData.total_cost;
            cost = typeof costRaw === "number" && Number.isFinite(costRaw) ? costRaw : null;
            orchestratorOk = true;
          } catch (e: any) {
            const msg = e?.name === "AbortError" ? "timeout" : (e?.message || String(e));
            failure_reason = `orchestrator: ${msg}`;
            errorCount++;
          }
          const latency_ms = Date.now() - t0;
          if (orchestratorOk) successLatencies.push(latency_ms);
          if (cost != null) costs.push(cost);

          let passed = false;
          let score: number | null = null;
          let explanation = "";
          const mode = qn.evaluation_mode || "";

          if (!orchestratorOk) {
            passed = false;
            explanation = failure_reason || "orquestador falló";
          } else if (!VALID_MODES.has(mode)) {
            passed = false;
            explanation = `evaluation_mode desconocido: "${mode}" → fail en seco`;
          } else if (mode === "det") {
            let expectedForDet: string | null = qn.expected_answer;
            if (qn.expected_sql) {
              try {
                const { data: sqlVal, error: sqlErr } = await admin.rpc("golden_eval_sql", { p_sql: qn.expected_sql });
                if (sqlErr) throw sqlErr;
                if (sqlVal != null) expectedForDet = String(sqlVal);
              } catch (e: any) {
                explanation = `expected_sql error: ${e.message || e}; `;
              }
            }
            const r = evalDet(expectedForDet, answer);
            passed = r.passed; explanation += r.explanation;
          } else if (mode === "set") {
            const r = evalSet(qn.expected_answer, qn.forbidden_behaviors, answer);
            passed = r.passed; explanation = r.explanation;
          } else if (mode === "binario") {
            passed = answer.trim().length > 0;
            explanation = "binario: respuesta no vacía";
          } else if (mode === "estricto" || mode === "rubrica") {
            if (!lovableKey) {
              passed = false; explanation = "sin LOVABLE_API_KEY para juez";
            } else {
              const r = await judgeWithLLM(lovableKey, qn.question, qn.expected_answer, answer, mode);
              passed = r.passed; score = r.score; explanation = r.explanation;
            }
          }

          if (passed) passedCount++;

          // Métricas derivadas
          const cat = (qn.category || "").toLowerCase();
          const code = (qn.code || "").toUpperCase();
          const isEstricto = mode === "estricto";
          const isNoInvencion = isEstricto || cat.includes("no") && cat.includes("inven") || cat === "meta" || cat === "honestidad" || code.startsWith("G");
          if (isNoInvencion && orchestratorOk) {
            hallucTotal++;
            const concrete = containsConcreteDatum(answer);
            const admits = acknowledgesMissing(answer);
            const halluc = concrete && !admits;
            if (halluc) hallucCount++;
          }
          const isRag = qn.source_type_expected === "RAG" || cat === "rag";
          if (isRag && orchestratorOk) {
            ragTotal++;
            if (passed) ragPassed++;
            // grounding: si hace afirmaciones concretas sin fuentes → grounding_fail
            groundTotal++;
            const emptySources = !Array.isArray(sources) || sources.length === 0;
            const claims = containsConcreteDatum(answer);
            const admits = acknowledgesMissing(answer);
            if (emptySources && claims && !admits) groundFail++;
          }
          if (cat.includes("router") || cat.includes("rendim") || cat === "honestidad" || code.startsWith("I")) {
            routeTotal++; if (passed) routePassed++;
          }

          const ins = await admin.from("golden_run_results").insert({
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
          if (ins.error) {
            // el registro no se guardó → no cuenta como aprobado
            if (passed) passedCount--;
            console.error("golden-run insert error:", ins.error.message);
          }
        }

        const total = questions.length || 1;
        const denomGround = hallucTotal + groundTotal;
        const hallucCombined = denomGround > 0 ? (hallucCount + groundFail) / denomGround : null;
        const srcPrec = ragTotal > 0 ? ragPassed / ragTotal : null;
        const routeAcc = routeTotal > 0 ? routePassed / routeTotal : null;
        const notes = `error_count=${errorCount}; halluc=${hallucCount}/${hallucTotal}; grounding_fail=${groundFail}/${groundTotal}; success_latencies=${successLatencies.length}`;

        await admin.from("golden_runs").update({
          status: "done",
          finished_at: new Date().toISOString(),
          accuracy: passedCount / total,
          latency_p50: successLatencies.length ? percentile(successLatencies, 50) : null,
          latency_p95: successLatencies.length ? percentile(successLatencies, 95) : null,
          avg_cost: costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null,
          hallucination_rate: hallucCombined,
          source_precision: srcPrec,
          route_accuracy: routeAcc,
          notes,
        }).eq("id", run.id);
      } catch (fatal: any) {
        console.error("golden-run worker fatal:", fatal);
        await admin.from("golden_runs").update({
          status: "failed",
          finished_at: new Date().toISOString(),
          notes: `worker fatal: ${fatal?.message || fatal}`,
        }).eq("id", run.id);
      }
    };

    // @ts-ignore EdgeRuntime es provisto por Supabase
    if (typeof EdgeRuntime !== "undefined" && (EdgeRuntime as any).waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(worker());
    } else {
      worker();
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
