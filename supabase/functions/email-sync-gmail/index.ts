// Sincroniza correos Gmail del buzón conectado y los matchea con contactos.
// POST { full?: boolean, max?: number, daysBack?: number }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GMAIL_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!GMAIL_KEY)
      throw new Error("GOOGLE_MAIL_API_KEY missing — connect Gmail in Settings");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const full = !!body.full;
    const max = Math.min(Number(body.max) || 200, 1000);
    const daysBack = Number(body.daysBack) || 30;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contactos } = await admin
      .from("contactos")
      .select("id, email")
      .eq("creado_por", user.id)
      .not("email", "is", null);
    const emailToContact = new Map<string, string>();
    for (const c of contactos || []) {
      if (c.email) emailToContact.set(c.email.toLowerCase().trim(), c.id);
    }
    if (emailToContact.size === 0) {
      return new Response(
        JSON.stringify({ success: true, synced: 0, matched: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let lastSyncedAt: string | null = null;
    if (!full) {
      const { data: state } = await admin
        .from("sync_state")
        .select("last_synced_at")
        .eq("owner_id", user.id)
        .eq("channel", "email_gmail")
        .maybeSingle();
      lastSyncedAt = state?.last_synced_at ?? null;
    }

    // Construir query Gmail
    const q = lastSyncedAt
      ? `after:${Math.floor(new Date(lastSyncedAt).getTime() / 1000)}`
      : `newer_than:${daysBack}d`;

    const meEmail = await getMeEmail(LOVABLE_API_KEY, GMAIL_KEY);
    let pageToken: string | null = null;
    let synced = 0;
    let matched = 0;
    let pages = 0;

    do {
      const listUrl = new URL(`${GATEWAY_URL}/users/me/messages`);
      listUrl.searchParams.set("q", q);
      listUrl.searchParams.set("maxResults", "100");
      if (pageToken) listUrl.searchParams.set("pageToken", pageToken);

      const listRes = await fetch(listUrl.toString(), {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GMAIL_KEY,
        },
      });
      if (!listRes.ok) {
        const t = await listRes.text();
        throw new Error(`Gmail list ${listRes.status}: ${t.slice(0, 300)}`);
      }
      const listData = await listRes.json();
      const ids: string[] = (listData.messages || []).map((m: any) => m.id);
      pageToken = listData.nextPageToken || null;
      pages++;

      // Fetch detalle en batch (paralelo limitado)
      const rows: any[] = [];
      const chunks = chunk(ids, 10);
      for (const c of chunks) {
        const detail = await Promise.all(
          c.map((id) =>
            fetch(
              `${GATEWAY_URL}/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
              {
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": GMAIL_KEY,
                },
              }
            ).then((r) => (r.ok ? r.json() : null))
          )
        );
        for (const m of detail) {
          if (!m) continue;
          const headers: Record<string, string> = {};
          for (const h of m.payload?.headers || []) {
            headers[h.name.toLowerCase()] = h.value;
          }
          const from = parseEmail(headers["from"] || "");
          const to = parseEmailList(headers["to"] || "");
          const cc = parseEmailList(headers["cc"] || "");
          const all = [...to, ...cc];

          let contactId: string | null = null;
          if (from.email && emailToContact.has(from.email)) {
            contactId = emailToContact.get(from.email)!;
          } else {
            for (const e of all) {
              if (emailToContact.has(e)) {
                contactId = emailToContact.get(e)!;
                break;
              }
            }
          }
          if (!contactId) continue;

          const direction =
            meEmail && from.email === meEmail.toLowerCase() ? "out" : "in";
          const sentAt = headers["date"]
            ? new Date(headers["date"]).toISOString()
            : new Date(parseInt(m.internalDate || "0")).toISOString();

          rows.push({
            owner_id: user.id,
            contact_id: contactId,
            channel: "email_gmail",
            external_id: m.id,
            direction,
            from_email: from.email,
            from_name: from.name,
            to_emails: all,
            subject: headers["subject"] || "(sin asunto)",
            body_snippet: (m.snippet || "").slice(0, 280),
            body_text: m.snippet || "",
            sent_at: sentAt,
            thread_external_id: m.threadId,
            metadata: { threadId: m.threadId, labelIds: m.labelIds },
          });
        }
      }

      if (rows.length > 0) {
        const { error, count } = await admin
          .from("contact_messages")
          .upsert(rows, {
            onConflict: "owner_id,channel,external_id",
            ignoreDuplicates: true,
            count: "exact",
          });
        if (error) throw error;
        matched += count ?? rows.length;
      }
      synced += ids.length;
      if (synced >= max) break;
    } while (pageToken && pages < 10);

    await admin
      .from("sync_state")
      .upsert(
        {
          owner_id: user.id,
          channel: "email_gmail",
          last_synced_at: new Date().toISOString(),
          metadata: { synced, matched },
        },
        { onConflict: "owner_id,channel" }
      );

    return new Response(
      JSON.stringify({ success: true, synced, matched, pages }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("email-sync-gmail error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function getMeEmail(lov: string, k: string): Promise<string | null> {
  try {
    const r = await fetch(`${GATEWAY_URL}/users/me/profile`, {
      headers: { Authorization: `Bearer ${lov}`, "X-Connection-Api-Key": k },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.emailAddress || null;
  } catch {
    return null;
  }
}

function parseEmail(s: string): { email: string; name: string } {
  const m = s.match(/^(.*?)<([^>]+)>$/);
  if (m) return { name: m[1].replace(/"/g, "").trim(), email: m[2].toLowerCase().trim() };
  return { name: "", email: s.toLowerCase().trim() };
}
function parseEmailList(s: string): string[] {
  return s
    .split(",")
    .map((x) => parseEmail(x.trim()).email)
    .filter(Boolean);
}
function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
