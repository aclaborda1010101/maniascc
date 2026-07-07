// m365-journal-sync
// Sincroniza el buzón de captura M365 (journaling) via Microsoft Graph (app-only)
// e inserta cada mensaje en public.email_ingest_queue para clasificación posterior.
//
// Auth: verify_jwt=false + validación interna (service-role key o JWT admin/gestor).
// Trigger: cron pg_cron cada 5 min y botón manual en Admin.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL = "m365_journal";
const JUNK_RE = /(noreply|no-reply|notifications?|newsletter|mailer-daemon|donotreply)/i;

function htmlToText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function graphToken(tenant: string, clientId: string, clientSecret: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`AAD token error [${r.status}]: ${t}`);
  }
  const j = await r.json();
  return j.access_token as string;
}

async function checkAuth(req: Request, supabase: any): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (svc && auth === `Bearer ${svc}`) return true;
  const tok = auth.replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  const { data, error } = await supabase.auth.getClaims(tok);
  if (error || !data?.claims?.sub) return false;
  const uid = data.claims.sub;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
  return (roles || []).some((r: any) => r.role === "admin" || r.role === "gestor");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const ok = await checkAuth(req, supabase);
    if (!ok) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenant = Deno.env.get("M365_TENANT_ID");
    const clientId = Deno.env.get("M365_CLIENT_ID");
    const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
    const mailbox = Deno.env.get("M365_JOURNAL_MAILBOX");
    if (!tenant || !clientId || !clientSecret || !mailbox) {
      console.log("[m365] M365 no configurado — faltan secrets");
      return new Response(
        JSON.stringify({ error: "M365 no configurado", missing: { tenant: !tenant, clientId: !clientId, clientSecret: !clientSecret, mailbox: !mailbox } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // primer admin como owner del cursor
    const { data: admins } = await supabase
      .from("user_roles").select("user_id").eq("role", "admin").limit(1);
    const ownerId = admins?.[0]?.user_id;
    if (!ownerId) {
      return new Response(JSON.stringify({ error: "No hay administradores en el sistema" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // cursor
    const { data: st } = await supabase
      .from("sync_state").select("cursor").eq("owner_id", ownerId).eq("channel", CHANNEL).maybeSingle();
    const cursor = st?.cursor || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    console.log(`[m365] sync desde cursor ${cursor}`);

    const token = await graphToken(tenant, clientId, clientSecret);

    const select = "id,internetMessageId,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments";
    let url: string | null =
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/mailFolders/inbox/messages` +
      `?$top=50&$orderby=receivedDateTime asc&$select=${select}` +
      `&$filter=${encodeURIComponent(`receivedDateTime gt ${cursor}`)}`;

    let pages = 0;
    let inserted = 0;
    let discarded = 0;
    let skipped = 0;
    let lastReceived = cursor;

    while (url && pages < 10) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) {
        const t = await r.text();
        console.error(`[m365] Graph error [${r.status}]: ${t}`);
        return new Response(JSON.stringify({ error: "graph_error", status: r.status, details: t }), {
          status: r.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const page = await r.json();
      const items: any[] = page.value || [];
      pages++;

      for (const m of items) {
        const imid = m.internetMessageId || m.id;
        if (!imid) continue;

        // dedup
        const { data: existing } = await supabase
          .from("email_ingest_queue").select("id").eq("internet_message_id", imid).maybeSingle();
        if (existing) { skipped++; continue; }

        const fromEmail = m.from?.emailAddress?.address?.toLowerCase() || null;
        const fromName = m.from?.emailAddress?.name || null;
        const toEmails = (m.toRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase()).filter(Boolean);
        const ccEmails = (m.ccRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase()).filter(Boolean);
        const bodyRaw = m.body?.contentType === "html" ? htmlToText(m.body?.content || "") : (m.body?.content || m.bodyPreview || "");
        const bodyText = bodyRaw.slice(0, 20000);

        const isJunk = fromEmail && JUNK_RE.test(fromEmail);
        const status = isJunk ? "discarded" : "pending";
        const classification = isJunk ? { motivo: "automatico", fuente_clasificacion: "filtro_basura" } : {};

        const { error: ie } = await supabase.from("email_ingest_queue").insert({
          graph_message_id: m.id,
          internet_message_id: imid,
          conversation_id: m.conversationId || null,
          received_at: m.receivedDateTime,
          from_email: fromEmail,
          from_name: fromName,
          to_emails: toEmails,
          cc_emails: ccEmails,
          subject: m.subject || "(sin asunto)",
          body_text: bodyText,
          has_attachments: !!m.hasAttachments,
          attachments: [],
          status,
          classification,
        });
        if (ie) {
          console.error(`[m365] insert error ${imid}: ${ie.message}`);
          continue;
        }
        if (isJunk) discarded++; else inserted++;
        if (m.receivedDateTime && m.receivedDateTime > lastReceived) lastReceived = m.receivedDateTime;
      }

      url = page["@odata.nextLink"] || null;
    }

    // upsert cursor
    await supabase.from("sync_state").upsert(
      { owner_id: ownerId, channel: CHANNEL, cursor: lastReceived, last_synced_at: new Date().toISOString(), metadata: { pages, inserted, discarded } },
      { onConflict: "owner_id,channel" },
    );

    console.log(`[m365] listo pages=${pages} inserted=${inserted} discarded=${discarded} skipped=${skipped}`);

    // Fire-and-forget classify
    if (inserted > 0) {
      const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
      fetch(`${base}/functions/v1/email-classify-journal`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      }).catch((e) => console.error("[m365] classify fire-and-forget:", e));
    }

    return new Response(JSON.stringify({ ok: true, pages, inserted, discarded, skipped, cursor: lastReceived }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[m365] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
