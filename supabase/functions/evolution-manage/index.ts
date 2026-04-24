import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { action, instance_name, evolution_url, evolution_api_key } =
      await req.json();

    if (!action) {
      return new Response(JSON.stringify({ error: "action required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get evolution credentials from profile or request body
    let evoUrl = evolution_url;
    let evoKey = evolution_api_key;
    let instanceName = instance_name;

    if (!evoUrl || !evoKey) {
      const { data: profile } = await supabase
        .from("perfiles")
        .select(
          "evolution_instance_url, evolution_api_key, evolution_instance_name"
        )
        .eq("user_id", userId)
        .single();

      if (profile) {
        evoUrl = evoUrl || profile.evolution_instance_url;
        evoKey = evoKey || profile.evolution_api_key;
        instanceName = instanceName || profile.evolution_instance_name;
      }
    }

    if (!evoUrl || !evoKey) {
      return new Response(
        JSON.stringify({ error: "Evolution API credentials not configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Normalize URL
    const baseUrl = evoUrl.replace(/\/+$/, "");

    if (action === "create_instance") {
      if (!instanceName) {
        return new Response(
          JSON.stringify({ error: "instance_name required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const res = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          apikey: evoKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
        }),
      });

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "check_status") {
      if (!instanceName) {
        return new Response(
          JSON.stringify({ error: "instance_name required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const res = await fetch(
        `${baseUrl}/instance/connectionState/${instanceName}`,
        { headers: { apikey: evoKey } }
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_qr") {
      if (!instanceName) {
        return new Response(
          JSON.stringify({ error: "instance_name required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const res = await fetch(
        `${baseUrl}/instance/connect/${instanceName}`,
        { headers: { apikey: evoKey } }
      );

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
