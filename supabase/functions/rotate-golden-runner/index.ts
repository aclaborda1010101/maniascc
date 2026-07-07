// One-off rotation: syncs auth.users password for GOLDEN_RUNNER_EMAIL to the
// value stored in the GOLDEN_RUNNER_PASSWORD secret. Requires SERVICE_ROLE bearer.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (auth !== serviceKey) {
      return new Response(JSON.stringify({ error: "service-role bearer required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const email = Deno.env.get("GOLDEN_RUNNER_EMAIL");
    const password = Deno.env.get("GOLDEN_RUNNER_PASSWORD");
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "GOLDEN_RUNNER_EMAIL/PASSWORD not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    // list & find user
    let userId: string | null = null;
    let page = 1;
    while (page < 20 && !userId) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const found = data.users.find((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (found) { userId = found.id; break; }
      if (data.users.length < 200) break;
      page++;
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: `user ${email} not found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    if (upErr) throw upErr;
    return new Response(JSON.stringify({ success: true, user_id: userId, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
