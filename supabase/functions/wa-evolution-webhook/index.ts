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

    console.log("[wa-webhook] event=", event, "instance=", instanceName);

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
    const evNorm = event.toLowerCase();
    const isMessage =
      evNorm.includes("messages.upsert") ||
      evNorm.includes("messages.update") ||
      evNorm === "messages_upsert" ||
      evNorm === "messages_update";

    if (!isMessage) {
      console.log("[wa-webhook] ignored event:", event);
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

    console.log("[wa-webhook] items=", items.length, "ownerId=", ownerId);

    const inserted: string[] = [];
    const touchedContacts = new Set<string>();
    const touchedThreads = new Set<string>();

    // Helper: resolver/crear contacto por teléfono
    async function resolveOrCreateContact(
      phone: string,
      pushName: string | null,
      owner: string,
    ): Promise<string | null> {
      const phoneDigits = phone.replace(/\D/g, "");
      if (!phoneDigits) return null;

      const { data: existing } = await supabase
        .from("contactos")
        .select("id, creado_por")
        .or(`whatsapp.ilike.%${phoneDigits}%,telefono.ilike.%${phoneDigits}%`)
        .limit(10);

      const match =
        (existing || []).find((c: any) => c.creado_por === owner) ||
        (existing || [])[0];
      if (match) return match.id;

      const { data: created, error: cErr } = await supabase
        .from("contactos")
        .insert({
          nombre: pushName || `WhatsApp ${phone}`,
          telefono: phone,
          whatsapp: phone,
          creado_por: owner,
          visibility: "shared",
          notas_perfil: "Auto-creado desde WhatsApp (Evolution)",
        })
        .select("id")
        .single();
      if (cErr) {
        console.error("[wa-webhook] error creating contact:", cErr.message);
        return null;
      }
      console.log("[wa-webhook] auto-created contact", created?.id, "for", phone);
      return created?.id ?? null;
    }

    for (const item of items) {
      const key = item.key || item.message?.key || {};
      const fromMe: boolean = !!key.fromMe;
      const remoteJid: string | undefined = key.remoteJid;
      const externalId: string | undefined = key.id || item.id;
      const phone = normalizePhone(jidToPhone(remoteJid));
      if (!phone || !externalId) {
        console.log("[wa-webhook] skip item (missing phone/id)", { remoteJid, externalId });
        continue;
      }

      const messageObj = item.message || item.messages || item;
      const text = extractText(messageObj);
      const pushName: string | null = item.pushName || null;
      const sentAt =
        item.messageTimestamp
          ? new Date(Number(item.messageTimestamp) * 1000).toISOString()
          : item.date_time || new Date().toISOString();

      // Owner: por instancia (perfil) o fallback al primer admin/gestor con esa instancia
      let finalOwner = ownerId;
      if (!finalOwner) {
        const { data: anyPerfil } = await supabase
          .from("perfiles")
          .select("user_id")
          .not("evolution_instance_name", "is", null)
          .limit(1)
          .maybeSingle();
        finalOwner = anyPerfil?.user_id || null;
      }
      if (!finalOwner) {
        console.error("[wa-webhook] no owner resolvable, skipping message");
        continue;
      }

      const contactId = await resolveOrCreateContact(phone, pushName, finalOwner);
      if (!contactId) continue;

      const { error: insErr, data: insData } = await supabase
        .from("contact_messages")
        .upsert(
          {
            owner_id: finalOwner,
            contact_id: contactId,
            channel: "whatsapp",
            external_id: `wa_${externalId}`,
            direction: fromMe ? "out" : "in",
            from_email: null,
            to_emails: [],
            from_name: pushName,
            subject: null,
            body_text: text,
            body_snippet: text.slice(0, 280),
            sent_at: sentAt,
            thread_external_id: remoteJid,
            metadata: { instance: instanceName, raw_event: event, jid: remoteJid },
          },
          { onConflict: "owner_id,channel,external_id", ignoreDuplicates: true },
        )
        .select("id");

      if (insErr) {
        console.error("[wa-webhook] insert contact_messages error:", insErr.message);
      } else if (insData && insData[0]) {
        inserted.push(insData[0].id);
        touchedContacts.add(contactId);
      }

      // Upsert whatsapp_threads (por owner + contact_phone)
      try {
        const { data: existingThread } = await supabase
          .from("whatsapp_threads")
          .select("id, message_count, first_date")
          .eq("owner_id", finalOwner)
          .eq("contact_phone", phone)
          .maybeSingle();

        if (existingThread) {
          await supabase
            .from("whatsapp_threads")
            .update({
              contact_id: contactId,
              contact_name: pushName || undefined,
              message_count: (existingThread.message_count || 0) + 1,
              last_date: sentAt,
              first_date: existingThread.first_date || sentAt,
              origen: "evolution_api",
              metadata: { instance: instanceName, jid: remoteJid },
            })
            .eq("id", existingThread.id);
          touchedThreads.add(existingThread.id);
        } else {
          const { data: newThread, error: tErr } = await supabase
            .from("whatsapp_threads")
            .insert({
              owner_id: finalOwner,
              visibility: "shared",
              contact_id: contactId,
              contact_name: pushName,
              contact_phone: phone,
              origen: "evolution_api",
              message_count: 1,
              first_date: sentAt,
              last_date: sentAt,
              metadata: { instance: instanceName, jid: remoteJid },
            })
            .select("id")
            .single();
          if (tErr) {
            console.error("[wa-webhook] insert whatsapp_threads error:", tErr.message);
          } else if (newThread) {
            touchedThreads.add(newThread.id);
          }
        }
      } catch (e) {
        console.error("[wa-webhook] thread upsert exception:", e);
      }

      // Bump contador en contactos
      await supabase.rpc as unknown; // placeholder; usar update simple
      await supabase
        .from("contactos")
        .update({
          last_contact: sentAt,
          wa_message_count: undefined as unknown as number,
        })
        .eq("id", contactId)
        .then(() => {})
        .catch(() => {});
    }

    console.log(
      "[wa-webhook] done. inserted=",
      inserted.length,
      "contacts=",
      touchedContacts.size,
      "threads=",
      touchedThreads.size,
    );

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
