// m365-journal-sync
// Sincroniza el buzón M365 (journaling) via Microsoft Graph app-only e inserta
// cada mensaje en public.email_ingest_queue.
// Soporta { test: true } → verifica conexión y lee 1 mensaje sin ingestar.
// Config: lee de public.email_classifier_settings; fallback a secrets M365_*.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHANNEL = "m365_journal";
const FOLDERS = ["inbox", "sentitems"] as const;
type Folder = typeof FOLDERS[number];
const channelFor = (f: Folder) => `${CHANNEL}:${f}`;
const MAX_PAGES_PER_FOLDER = 5;
const JUNK_RE = /(noreply|no-reply|notifications?|newsletter|mailer-daemon|donotreply)/i;

function htmlToText(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<\/?[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();
}

export interface M365Config {
  tenant: string; clientId: string; clientSecret: string; mailbox: string;
  source: "db" | "env" | "mixed";
}

export async function loadM365Config(supabase: any): Promise<M365Config | { error: string }> {
  const { data: cfg } = await supabase.from("email_classifier_settings")
    .select("m365_tenant_id,m365_client_id,m365_client_secret,m365_journal_mailbox").limit(1).maybeSingle();
  const tenant = cfg?.m365_tenant_id || Deno.env.get("M365_TENANT_ID") || "";
  const clientId = cfg?.m365_client_id || Deno.env.get("M365_CLIENT_ID") || "";
  const clientSecret = cfg?.m365_client_secret || Deno.env.get("M365_CLIENT_SECRET") || "";
  const mailbox = cfg?.m365_journal_mailbox || Deno.env.get("M365_JOURNAL_MAILBOX") || "";
  if (!tenant || !clientId || !clientSecret || !mailbox) {
    return { error: "M365 no configurado. Rellena tenant_id, client_id, client_secret y buzón en Admin → Correo M365." };
  }
  const fromDb = !!(cfg?.m365_tenant_id && cfg?.m365_client_id && cfg?.m365_client_secret && cfg?.m365_journal_mailbox);
  return { tenant, clientId, clientSecret, mailbox, source: fromDb ? "db" : "env" };
}

export async function graphToken(cfg: M365Config): Promise<string> {
  const body = new URLSearchParams({
    client_id: cfg.clientId, client_secret: cfg.clientSecret,
    scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body,
  });
  if (!r.ok) {
    const t = await r.text();
    // Traducir errores comunes
    let msg = `AAD ${r.status}`;
    if (/AADSTS7000215|invalid_client/i.test(t)) msg = "Client secret inválido o caducado.";
    else if (/AADSTS700016|application with identifier/i.test(t)) msg = "Client ID no encontrado en el tenant.";
    else if (/AADSTS90002|Tenant.*not found/i.test(t)) msg = "Tenant ID no existe.";
    else msg = `Error obteniendo token (${r.status}): ${t.slice(0, 200)}`;
    throw new Error(msg);
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

async function runEscalation(supabase: any) {
  // needs_review > 3 días → notificar admins (una vez, marcar escalated_at)
  const cutoff = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString();
  const { data: stuck } = await supabase.from("email_ingest_queue")
    .select("id,subject,assigned_to")
    .eq("status", "needs_review")
    .is("escalated_at", null)
    .lte("received_at", cutoff)
    .limit(50);
  if (!stuck?.length) return 0;
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = (admins || []).map((r: any) => r.user_id);
  const notifs: any[] = [];
  for (const it of stuck) {
    for (const uid of adminIds) {
      notifs.push({
        user_id: uid,
        type: "email_review_stale",
        title: "Correo pendiente de revisión >3 días",
        description: `AVA lleva más de 3 días esperando validación: ${it.subject || "(sin asunto)"}`,
        link: `/bandeja-correo?item=${it.id}`,
      });
    }
    await supabase.from("email_ingest_queue").update({ escalated_at: new Date().toISOString() }).eq("id", it.id);
  }
  if (notifs.length) await supabase.from("notificaciones").insert(notifs);
  return stuck.length;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const ok = await checkAuth(req, supabase);
    if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let payload: any = {};
    try { payload = await req.json(); } catch { /* empty */ }
    const testMode = payload.test === true;

    // Permite payload {tenant_id, client_id, client_secret, journal_mailbox} para probar sin guardar
    let cfg: M365Config;
    if (testMode && payload.tenant_id && payload.client_id && payload.journal_mailbox) {
      cfg = {
        tenant: payload.tenant_id,
        clientId: payload.client_id,
        clientSecret: payload.client_secret || "",
        mailbox: payload.journal_mailbox,
        source: "db",
      };
      // Si no viene client_secret, reusa el almacenado
      if (!cfg.clientSecret) {
        const { data: row } = await supabase.from("email_classifier_settings").select("m365_client_secret").limit(1).maybeSingle();
        cfg.clientSecret = row?.m365_client_secret || Deno.env.get("M365_CLIENT_SECRET") || "";
      }
      if (!cfg.clientSecret) {
        return new Response(JSON.stringify({ ok: false, error: "Falta client_secret para probar." }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      const loaded = await loadM365Config(supabase);
      if ("error" in loaded) return new Response(JSON.stringify({ ok: false, error: loaded.error }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      cfg = loaded;
    }

    // ── Modo test ──────────────────────────────────────
    if (testMode) {
      try {
        const token = await graphToken(cfg);
        const results: Record<string, { ok: boolean; count?: number; lastSubject?: string; error?: string }> = {};
        for (const folder of FOLDERS) {
          const r = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/mailFolders/${folder}/messages?$top=1&$select=id,subject,receivedDateTime`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) {
            const t = await r.text();
            let msg = `Graph ${r.status}`;
            if (r.status === 404) msg = `Carpeta '${folder}' no encontrada en ${cfg.mailbox}.`;
            else if (r.status === 403) msg = "Permisos insuficientes. Concede Mail.Read (app-only) en Azure AD.";
            else if (r.status === 401) msg = "Token rechazado por Graph. Revisa scopes y consentimiento del admin.";
            else msg = `${msg}: ${t.slice(0, 160)}`;
            results[folder] = { ok: false, error: msg };
          } else {
            const j = await r.json();
            results[folder] = { ok: true, count: (j.value || []).length, lastSubject: j.value?.[0]?.subject || "(vacío)" };
          }
        }
        const allOk = Object.values(results).every((v) => v.ok);
        const summary = FOLDERS.map((f) => {
          const r = results[f];
          return r.ok ? `${f}: OK (último: ${r.lastSubject})` : `${f}: ${r.error}`;
        }).join(" | ");
        const okMsg = allOk ? `OK. ${summary}` : summary;
        await supabase.from("email_classifier_settings").update({ m365_last_test_at: new Date().toISOString(), m365_last_test_result: okMsg, m365_connected: allOk }).neq("id", "00000000-0000-0000-0000-000000000000");
        return new Response(JSON.stringify({ ok: allOk, message: okMsg, folders: results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e: any) {
        const msg = e?.message || String(e);
        await supabase.from("email_classifier_settings").update({ m365_last_test_at: new Date().toISOString(), m365_last_test_result: msg, m365_connected: false }).neq("id", "00000000-0000-0000-0000-000000000000");
        return new Response(JSON.stringify({ ok: false, error: msg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // ── Sync normal ────────────────────────────────────
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    const ownerId = admins?.[0]?.user_id;
    if (!ownerId) return new Response(JSON.stringify({ error: "No hay administradores en el sistema" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Migración one-shot del cursor antiguo 'm365_journal' → 'm365_journal:inbox'
    const { data: legacy } = await supabase.from("sync_state").select("cursor").eq("owner_id", ownerId).eq("channel", CHANNEL).maybeSingle();
    if (legacy?.cursor) {
      const { data: already } = await supabase.from("sync_state").select("channel").eq("owner_id", ownerId).eq("channel", channelFor("inbox")).maybeSingle();
      if (!already) {
        await supabase.from("sync_state").upsert(
          { owner_id: ownerId, channel: channelFor("inbox"), cursor: legacy.cursor, last_synced_at: new Date().toISOString(), metadata: { migrated_from: CHANNEL } },
          { onConflict: "owner_id,channel" },
        );
      }
      await supabase.from("sync_state").delete().eq("owner_id", ownerId).eq("channel", CHANNEL);
    }


    const token = await graphToken(cfg);
    const select = "id,internetMessageId,conversationId,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,hasAttachments";

    let totalPages = 0, inserted = 0, discarded = 0, skipped = 0;
    const perFolder: Record<string, { pages: number; inserted: number; discarded: number; skipped: number; cursor: string }> = {};

    for (const folder of FOLDERS) {
      const ch = channelFor(folder);
      const { data: st } = await supabase.from("sync_state").select("cursor").eq("owner_id", ownerId).eq("channel", ch).maybeSingle();
      const cursor = st?.cursor || new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      console.log(`[m365:${folder}] sync desde ${cursor}`);

      let url: string | null =
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(cfg.mailbox)}/mailFolders/${folder}/messages` +
        `?$top=50&$orderby=receivedDateTime asc&$select=${select}` +
        `&$filter=${encodeURIComponent(`receivedDateTime gt ${cursor}`)}`;

      let pages = 0, fIns = 0, fDisc = 0, fSkip = 0;
      let lastReceived = cursor;

      while (url && pages < MAX_PAGES_PER_FOLDER) {
        const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) {
          const t = await r.text();
          console.error(`[m365:${folder}] Graph error [${r.status}]: ${t}`);
          // No abortamos las demás carpetas; anotamos y salimos de esta
          break;
        }
        const page = await r.json();
        const items: any[] = page.value || [];
        pages++;

        for (const m of items) {
          const imid = m.internetMessageId || m.id;
          if (!imid) continue;
          const { data: existing } = await supabase.from("email_ingest_queue").select("id").eq("internet_message_id", imid).maybeSingle();
          if (existing) { fSkip++; continue; }

          const fromEmail = m.from?.emailAddress?.address?.toLowerCase() || null;
          const fromName = m.from?.emailAddress?.name || null;
          const toEmails = (m.toRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase()).filter(Boolean);
          const ccEmails = (m.ccRecipients || []).map((r: any) => r.emailAddress?.address?.toLowerCase()).filter(Boolean);
          const bodyRaw = m.body?.contentType === "html" ? htmlToText(m.body?.content || "") : (m.body?.content || m.bodyPreview || "");
          const bodyText = bodyRaw.slice(0, 20000);

          const isJunk = fromEmail && JUNK_RE.test(fromEmail);
          const status = isJunk ? "discarded" : "pending";
          const classification = isJunk
            ? { motivo: "automatico", fuente_clasificacion: "filtro_basura", source_folder: folder }
            : { source_folder: folder };

          const { error: ie } = await supabase.from("email_ingest_queue").insert({
            graph_message_id: m.id, internet_message_id: imid, conversation_id: m.conversationId || null,
            received_at: m.receivedDateTime, from_email: fromEmail, from_name: fromName,
            to_emails: toEmails, cc_emails: ccEmails, subject: m.subject || "(sin asunto)",
            body_text: bodyText, has_attachments: !!m.hasAttachments, attachments: [],
            status, classification,
          });
          if (ie) { console.error(`[m365:${folder}] insert err ${imid}: ${ie.message}`); continue; }
          if (isJunk) fDisc++; else fIns++;
          if (m.receivedDateTime && m.receivedDateTime > lastReceived) lastReceived = m.receivedDateTime;
        }
        url = page["@odata.nextLink"] || null;
      }

      await supabase.from("sync_state").upsert(
        { owner_id: ownerId, channel: ch, cursor: lastReceived, last_synced_at: new Date().toISOString(), metadata: { pages, inserted: fIns, discarded: fDisc, folder } },
        { onConflict: "owner_id,channel" },
      );

      perFolder[folder] = { pages, inserted: fIns, discarded: fDisc, skipped: fSkip, cursor: lastReceived };
      totalPages += pages; inserted += fIns; discarded += fDisc; skipped += fSkip;
    }


    if (inserted > 0) {
      const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
      fetch(`${base}/functions/v1/email-classify-journal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch((e) => console.error("[m365] fire classify:", e));
    }

    // Escalado (barato: cada sync)
    let escalated = 0;
    try { escalated = await runEscalation(supabase); } catch (e: any) { console.error("[m365] escalate:", e?.message); }

    console.log(`[m365] pages=${totalPages} inserted=${inserted} discarded=${discarded} skipped=${skipped} escalated=${escalated}`);
    return new Response(JSON.stringify({ ok: true, pages: totalPages, inserted, discarded, skipped, escalated, folders: perFolder, config_source: cfg.source }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[m365] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
