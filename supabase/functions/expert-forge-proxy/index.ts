import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPERT_FORGE_URL = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";
const EXPERT_FORGE_PROJECT_ID = "5123d6ea-14aa-4f73-a547-07393d583e89";
const EXPERT_FORGE_ROUTER_ID = "3fb91959-eff3-4eb7-bdfe-d6609814b8f0";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const reqBody = await req.json();
    const { action, question, specialist_id, context } = reqBody;

    const apiKey = Deno.env.get("EXPERT_FORGE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EXPERT_FORGE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Health check: verify gateway is reachable without needing router_id/question
    if (action === "health_check") {
      const startMs = Date.now();
      try {
        const hcResp = await fetch(EXPERT_FORGE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify({ action: "list_projects" }),
        });
        const latencyMs = Date.now() - startMs;
        const hcData = await hcResp.json();
        if (hcResp.ok) {
          return new Response(JSON.stringify({
            status: "ok",
            latency_ms: latencyMs,
            projects_count: hcData.projects?.length || 0,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({
          status: "error",
          latency_ms: latencyMs,
          error: hcData.error || `HTTP ${hcResp.status}`,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({
          status: "error",
          latency_ms: Date.now() - startMs,
          error: e.message,
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Normal query flow
    if (!question) {
      return new Response(JSON.stringify({ error: "question es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startMs = Date.now();

    const body: Record<string, unknown> = {
      action: "query",
      router_id: EXPERT_FORGE_ROUTER_ID,
      project_id: EXPERT_FORGE_PROJECT_ID,
      api_key: apiKey,
      question,
    };
    if (specialist_id) body.specialist_id = specialist_id;
    if (context) body.context = context;

    const resp = await fetch(EXPERT_FORGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startMs;
    const result = await resp.json();

    const tokensIn = result.tokens?.input || 0;
    const tokensOut = result.tokens?.output || 0;
    const modelUsed = result.model || result.specialist_used || "expert-forge-moe";
    // Expert Forge uses its own MoE routing — use reported cost or estimate based on Gemini pricing
    const costEur = result.cost || (tokensIn * 0.10 / 1_000_000 * 0.92 + tokensOut * 0.40 / 1_000_000 * 0.92);

    // Audit log
    await supabase.from("auditoria_ia").insert({
      funcion_ia: "expert-forge-proxy",
      modelo: result.model || result.specialist_used || "expert-forge-moe",
      exito: resp.ok,
      latencia_ms: latencyMs,
      tokens_entrada: tokensIn || null,
      tokens_salida: tokensOut || null,
      coste_estimado: costEur || null,
      error_mensaje: resp.ok ? null : (result.error || `HTTP ${resp.status}`),
      created_by: user.id,
    });

    // Usage log for cost tracking
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await serviceClient.from("usage_logs").insert({
      user_id: user.id,
      action_type: "expert-forge",
      agent_id: specialist_id || null,
      agent_label: result.specialist_used || specialist_id || "MoE Router",
      rag_filter: context?.rag_filter || null,
      tokens_input: tokensIn,
      tokens_output: tokensOut,
      cost_eur: costEur,
      latency_ms: latencyMs,
      metadata: { question: question?.slice(0, 200) },
    });

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: result.error || `Expert Forge error ${resp.status}` }), {
        status: resp.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...result, latency_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
