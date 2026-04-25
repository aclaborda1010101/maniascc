// Genera alertas: inactividad (>21d sin contacto con sentiment positivo histórico)
// y compromisos pendientes (tareas vencidas).
// Puede invocarse manualmente o por cron.
//
// POST {} — auth: usuario o service role.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let alertsCreated = 0;

    // Inactividad: contactos del owner con last_contact > 21d
    const cutoff = new Date(Date.now() - 21 * 86400 * 1000).toISOString();
    const { data: stale } = await admin
      .from("contactos")
      .select("id, nombre, apellidos, last_contact")
      .eq("creado_por", user.id)
      .lt("last_contact", cutoff)
      .not("last_contact", "is", null)
      .limit(500);

    for (const c of stale || []) {
      // Evitar duplicar alertas activas
      const { data: existing } = await admin
        .from("contact_alerts")
        .select("id")
        .eq("contact_id", c.id)
        .eq("tipo", "inactividad")
        .is("dismissed_at", null)
        .maybeSingle();
      if (existing) continue;

      const days = Math.floor(
        (Date.now() - new Date(c.last_contact).getTime()) / 86400000
      );
      const { error } = await admin.from("contact_alerts").insert({
        owner_id: user.id,
        contact_id: c.id,
        tipo: "inactividad",
        severity: days > 60 ? "high" : days > 40 ? "warn" : "info",
        mensaje: `Llevas ${days} días sin hablar con ${c.nombre || ""}. ¿Le das un toque?`,
        payload: { days_since_last: days },
      });
      if (!error) alertsCreated++;
    }

    // Compromisos pendientes: tareas vencidas
    const { data: overdue } = await admin
      .from("contact_tasks")
      .select("id, contact_id, title, due_at")
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .lt("due_at", new Date().toISOString())
      .limit(500);

    for (const t of overdue || []) {
      const { data: existing } = await admin
        .from("contact_alerts")
        .select("id")
        .eq("contact_id", t.contact_id)
        .eq("tipo", "compromiso_pendiente")
        .contains("payload", { task_id: t.id })
        .is("dismissed_at", null)
        .maybeSingle();
      if (existing) continue;

      const { error } = await admin.from("contact_alerts").insert({
        owner_id: user.id,
        contact_id: t.contact_id,
        tipo: "compromiso_pendiente",
        severity: "warn",
        mensaje: `Tarea vencida: "${t.title}"`,
        payload: { task_id: t.id, due_at: t.due_at },
      });
      if (!error) alertsCreated++;
    }

    return new Response(
      JSON.stringify({ success: true, alerts_created: alertsCreated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("contact-alerts-scan error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
