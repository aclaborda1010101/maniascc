// Webhook receptor para Evolution API (WhatsApp).
// Recibe eventos messages.upsert / messages.update y los normaliza
// hacia la tabla unificada contact_messages.
// verify_jwt=false (configurado en config.toml). Se valida vía secret en header.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-evolution-secret, apikey",
};

function jidToPhone(jid: string | undefined): string | null {
  if (!jid) return null;
  // p.ej. "34666111222@s.whatsapp.net" o "34666111222@c.us"
  const m = jid.match(/^(\d+)@/);
  return m ? m[1] : null;
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return "+" + phone.replace(/[^\d]/g, "");
}

function extractText(msg: any): string {
  if (!msg) return "";
  if (typeof msg.conversation === "string") return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  if (msg.audioMessage) return "[audio]";
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate shared secret
    const expectedSecret = Deno.env.get("EVOLUTION_WEBHOOK_SECRET");
    const providedSecret =
      req.headers.get("x-evolution-secret") ||
      req.headers.get("apikey") ||
      new URL(req.url).searchParams.get("secret");

    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const payload = await req.json().catch(() => ({}));

    // Evolution puede enviar { event, instance, data } o { event, data: { ... } }
    const event: string = payload.event || payload.type || "unknown";
    const instanceName: string | null =
      payload.instance || payload.instanceName || payload.data?.instance || null;

    // Identificar dueño (perfil) por instancia
    let ownerId: string | null = null;
    if (instanceName) {
      const { data: perfil } = await supabase
        .from("perfiles")
        .select("user_id")
        .eq("evolution_instance_name", instanceName)
        .maybeSingle();
      ownerId = perfil?.user_id || null;
    }

    // Solo procesamos eventos de mensaje
    const isMessage =
      event.includes("messages.upsert") ||
      event.includes("messages.update") ||
      event === "MESSAGES_UPSERT";

    if (!isMessage) {
      return new Response(JSON.stringify({ ok: true, ignored: event }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalizar a array de mensajes
    const raw = payload.data;
    const items: any[] = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.messages)
      ? raw.messages
      : raw
      ? [raw]
      : [];

    const inserted: string[] = [];
    const touchedContacts = new Set<string>();

    for (const item of items) {
      const key = item.key || item.message?.key || {};
      const fromMe: boolean = !!key.fromMe;
      const remoteJid: string | undefined = key.remoteJid;
      const externalId: string | undefined = key.id || item.id;
      const phone = normalizePhone(jidToPhone(remoteJid));
      if (!phone || !externalId) continue;

      const messageObj = item.message || item.messages || item;
      const text = extractText(messageObj);
      const sentAt =
        item.messageTimestamp
          ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
          : item.date_time || new Date().toISOString();

      // Match contacto por whatsapp/teléfono
      const phoneDigits = phone.replace(/\D/g, "");
      const { data: contactos } = await supabase
        .from("contactos")
        .select("id, owner_id:creado_por")
        .or(`whatsapp.ilike.%${phoneDigits}%,telefono.ilike.%${phoneDigits}%`)
        .limit(5);

      const contact = (contactos || []).find((c: any) =>
        ownerId ? c.owner_id === ownerId : true,
      ) || (contactos || [])[0];

      if (!contact) continue;
      const finalOwner = ownerId || contact.owner_id;
      if (!finalOwner) continue;

      const { error: insErr, data: insData } = await supabase
        .from("contact_messages")
        .upsert(
          {
            owner_id: finalOwner,
            contact_id: contact.id,
            channel: "whatsapp",
            external_id: `wa_${externalId}`,
            direction: fromMe ? "out" : "in",
            from_email: null,
            to_emails: [],
            from_name: item.pushName || null,
            subject: null,
            body_text: text,
            body_snippet: text.slice(0, 280),
            sent_at: sentAt,
            thread_external_id: remoteJid,
            metadata: { instance: instanceName, raw_event: event },
          },
          { onConflict: "external_id", ignoreDuplicates: true },
        )
        .select("id");

      if (!insErr && insData && insData[0]) {
        inserted.push(insData[0].id);
        touchedContacts.add(contact.id);
      }
    }

    // Disparar extractor de señales para los contactos tocados (fire-and-forget)
    const projectUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const cid of touchedContacts) {
      fetch(`${projectUrl}/functions/v1/contact-extract-signals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ contact_id: cid }),
      }).catch(() => {});
    }

    return new Response(
      JSON.stringify({
        ok: true,
        event,
        inserted: inserted.length,
        contacts_touched: touchedContacts.size,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("wa-evolution-webhook error", err);
    return new Response(
      JSON.stringify({ error: String((err as Error).message || err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
