// TEMPORARY ENDPOINT — DELETE AFTER USE
// Returns the SUPABASE_SERVICE_ROLE_KEY value once a valid one-time token is provided.
// Token is hardcoded server-side and rotated/deleted by removing this function.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-echo-token",
};

const ONE_TIME_TOKEN = "0ba53c9d848c4f6191c9e759cf0fbab5a20becd374e33bc5839d66881cd439e1";

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const provided = req.headers.get("x-echo-token");
  if (provided !== ONE_TIME_TOKEN) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

  return new Response(
    JSON.stringify({
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      length: serviceKey.length,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
