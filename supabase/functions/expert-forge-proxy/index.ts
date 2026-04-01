import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXPERT_FORGE_URL = "https://nhfocnjtgwuamelovncq.supabase.co/functions/v1/api-gateway";
const EXPERT_FORGE_PROJECT_ID = "5123d6ea";

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

    const { question, specialist_id, context } = await req.json();
    if (!question) {
      return new Response(JSON.stringify({ error: "question es obligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EXPERT_FORGE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EXPERT_FORGE_API_KEY no configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const startMs = Date.now();

    const body: Record<string, unknown> = {
      action: "query",
      router_id: EXPERT_FORGE_PROJECT_ID,
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
        "Authorization": authHeader,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const latencyMs = Date.now() - startMs;
    const result = await resp.json();

    // Audit log
    await supabase.from("auditoria_ia").insert({
      funcion_ia: "expert-forge-proxy",
      modelo: result.model || result.specialist_used || "expert-forge-moe",
      exito: resp.ok,
      latencia_ms: latencyMs,
      tokens_entrada: result.tokens?.input || null,
      tokens_salida: result.tokens?.output || null,
      coste_estimado: result.cost || null,
      error_mensaje: resp.ok ? null : (result.error || `HTTP ${resp.status}`),
      created_by: user.id,
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
