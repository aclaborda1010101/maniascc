// Sincroniza correos del buzón Outlook conectado del usuario y los matchea
// contra public.contactos por email. Idempotente vía external_id (id Outlook).
//
// POST { full?: boolean, max?: number } — full=true ignora cursor, max default 200.
// Auth: requiere JWT del usuario (toma owner_id de auth).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/microsoft_outlook";

interface OutlookMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { content: string; contentType: string };
  from?: { emailAddress: { address: string; name: string } };
  toRecipients?: Array<{ emailAddress: { address: string; name?: string } }>;
  ccRecipients?: Array<{ emailAddress: { address: string } }>;
  receivedDateTime: string;
  sentDateTime: string;
  conversationId: string;
  isDraft?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const OUTLOOK_KEY = Deno.env.get("MICROSOFT_OUTLOOK_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
    if (!OUTLOOK_KEY)
      throw new Error(
        "MICROSOFT_OUTLOOK_API_KEY missing — connect Microsoft Outlook in Settings"
      );

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error("Not authenticated");

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const full = !!body.full;
    const max = Math.min(Number(body.max) || 200, 1000);

    // Service role para insertar saltando RLS (controlamos owner_id manualmente)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Cargar todos los emails de contactos del owner para matching rápido
    const { data: contactos, error: cErr } = await admin
      .from("contactos")
      .select("id, email, creado_por")
      .eq("creado_por", user.id)
      .not("email", "is", null);
    if (cErr) throw cErr;

    const emailToContact = new Map<string, string>();
    for (const c of contactos || []) {
      if (c.email) emailToContact.set(c.email.toLowerCase().trim(), c.id);
    }

    if (emailToContact.size === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          matched: 0,
          message: "No hay contactos con email para matchear",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cursor previo
    let lastSyncedAt: string | null = null;
    if (!full) {
      const { data: state } = await admin
        .from("sync_state")
        .select("last_synced_at")
        .eq("owner_id", user.id)
        .eq("channel", "email_outlook")
        .maybeSingle();
      lastSyncedAt = state?.last_synced_at ?? null;
    }

    let url = `${GATEWAY_URL}/me/messages?$top=100&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,ccRecipients,receivedDateTime,sentDateTime,conversationId,isDraft`;
    if (lastSyncedAt) {
      const iso = encodeURIComponent(new Date(lastSyncedAt).toISOString());
      url += `&$filter=receivedDateTime ge ${iso}`;
    }

    let synced = 0;
    let matched = 0;
    let pages = 0;
    let nextLink: string | null = url;
    const meEmail = await getMeEmail(LOVABLE_API_KEY, OUTLOOK_KEY);

    while (nextLink && synced < max && pages < 20) {
      const res = await fetch(nextLink, {
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": OUTLOOK_KEY,
        },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Outlook API ${res.status}: ${txt.slice(0, 300)}`);
      }
      const data = await res.json();
      const items: OutlookMessage[] = data.value || [];
      pages++;
      nextLink = data["@odata.nextLink"] || null;

      const rows: any[] = [];
      for (const m of items) {
        if (m.isDraft) continue;
        const fromEmail = m.from?.emailAddress?.address?.toLowerCase().trim();
        const toAll: string[] = [
          ...(m.toRecipients || []),
          ...(m.ccRecipients || []),
        ].map((r) => r.emailAddress.address?.toLowerCase().trim()).filter(Boolean);

        // Buscar contacto entre from y to
        let contactId: string | null = null;
        if (fromEmail && emailToContact.has(fromEmail)) {
          contactId = emailToContact.get(fromEmail)!;
        } else {
          for (const t of toAll) {
            if (emailToContact.has(t)) {
              contactId = emailToContact.get(t)!;
              break;
            }
          }
        }
        if (!contactId) continue;

        const direction =
          meEmail && fromEmail === meEmail.toLowerCase() ? "out" : "in";

        const bodyText = htmlToText(m.body?.content || m.bodyPreview || "");
        rows.push({
          owner_id: user.id,
          contact_id: contactId,
          channel: "email_outlook",
          external_id: m.id,
          direction,
          from_email: fromEmail,
          from_name: m.from?.emailAddress?.name,
          to_emails: toAll,
          subject: m.subject || "(sin asunto)",
          body_text: bodyText.slice(0, 20000),
          body_snippet: m.bodyPreview?.slice(0, 280),
          sent_at: m.receivedDateTime || m.sentDateTime,
          thread_external_id: m.conversationId,
          metadata: { conversationId: m.conversationId },
        });
      }

      if (rows.length > 0) {
        const { error: insErr, count } = await admin
          .from("contact_messages")
          .upsert(rows, {
            onConflict: "owner_id,channel,external_id",
            ignoreDuplicates: true,
            count: "exact",
          });
        if (insErr) throw insErr;
        matched += count ?? rows.length;
      }
      synced += items.length;
      if (items.length < 100) break;
    }

    // Guardar cursor
    await admin
      .from("sync_state")
      .upsert(
        {
          owner_id: user.id,
          channel: "email_outlook",
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
    console.error("email-sync-outlook error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function getMeEmail(lovKey: string, conKey: string): Promise<string | null> {
  try {
    const r = await fetch(`${GATEWAY_URL}/me?$select=mail,userPrincipalName`, {
      headers: {
        Authorization: `Bearer ${lovKey}`,
        "X-Connection-Api-Key": conKey,
      },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.mail || d.userPrincipalName || null;
  } catch {
    return null;
  }
}

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
