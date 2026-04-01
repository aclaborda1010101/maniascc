import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const jarvisUrl = Deno.env.get("JARVIS_PATTERNS_URL");
    const jarvisKey = Deno.env.get("JARVIS_PATTERNS_API_KEY");

    if (!jarvisUrl || !jarvisKey) {
      return new Response(JSON.stringify({ error: "JARVIS_PATTERNS_URL o JARVIS_PATTERNS_API_KEY no configuradas" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, query_type, filters, feedback_type, data } = body;

    // Build JARVIS payload
    const jarvisBody: Record<string, unknown> = { api_key: jarvisKey };

    if (action === "feedback_ingest" || feedback_type) {
      jarvisBody.action = "feedback_ingest";
      jarvisBody.feedback_type = feedback_type || body.feedback_type;
      jarvisBody.data = data || {};
    } else if (action === "list_available_runs") {
      jarvisBody.action = "list_available_runs";
    } else {
      // Default: public_query_v2
      jarvisBody.action = "public_query_v2";
      jarvisBody.query_type = query_type || "full_intelligence";
      jarvisBody.filters = filters || {};
    }

    const startMs = Date.now();
    const resp = await fetch(jarvisUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jarvisBody),
    });

    const latencyMs = Date.now() - startMs;
    const result = await resp.json();

    // Audit
    await supabase.from("auditoria_ia").insert({
      funcion_ia: "pattern-proxy",
      modelo: "jarvis-patterns",
      exito: resp.ok,
      latencia_ms: latencyMs,
      error_mensaje: resp.ok ? null : (result.error || `HTTP ${resp.status}`),
      created_by: user.id,
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de peticiones JARVIS excedido" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: result.error || `JARVIS error ${resp.status}` }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ...result, latency_ms: latencyMs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("pattern-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Error desconocido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
