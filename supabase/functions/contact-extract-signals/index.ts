// Extrae señales (próxima acción, tareas, hitos, sentiment, oportunidades)
// de los últimos mensajes no procesados de un contacto. Llama a Lovable AI
// (gemini-2.5-flash) para devolver JSON estructurado.
//
// POST { contact_id: uuid, force?: boolean, lookback?: number }
// Auth: requiere JWT del usuario.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const body = await req.json();
    const { contact_id, force = false, lookback = 30 } = body;
    if (!contact_id) throw new Error("contact_id required");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: contacto } = await admin
      .from("contactos")
      .select("id, nombre, apellidos, empresa, email, perfil_ia")
      .eq("id", contact_id)
      .single();
    if (!contacto) throw new Error("Contact not found");

    let q = admin
      .from("contact_messages")
      .select("*")
      .eq("contact_id", contact_id)
      .eq("owner_id", user.id)
      .order("sent_at", { ascending: false })
      .limit(lookback);

    if (!force) q = q.is("processed_at", null);

    const { data: msgs, error } = await q;
    if (error) throw error;
    if (!msgs || msgs.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No new messages", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const messagesText = msgs
      .reverse()
      .map(
        (m, i) =>
          `[${i}] ${m.sent_at} · ${m.direction === "in" ? "DE" : "PARA"} ${m.from_email} · ${m.subject}\n${(m.body_text || m.body_snippet || "").slice(0, 1500)}`
      )
      .join("\n\n---\n\n");

    const nombre = `${contacto.nombre || ""} ${contacto.apellidos || ""}`.trim();
    const messageIds = msgs.map((m) => m.id);

    const systemPrompt = `Eres un analista CRM. Recibes mensajes (correos/WhatsApp) entre nosotros y un contacto. Extraes en JSON estricto: próxima acción concreta, tareas pendientes (cosas que prometimos o que él espera), hitos significativos (acuerdos, tensiones, primer contacto, cierres, incidencias), tono general por mensaje, temas recurrentes y posibles oportunidades de negocio. Sé conciso y accionable. NO inventes fechas; si no hay fecha clara deja due_at en null.`;

    const schema = {
      type: "object",
      properties: {
        next_action: {
          type: ["object", "null"],
          properties: {
            title: { type: "string" },
            when: { type: ["string", "null"] },
            why: { type: "string" },
          },
        },
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              due_at: { type: ["string", "null"], description: "ISO 8601 o null" },
              priority: { type: "integer", minimum: 1, maximum: 5 },
              source_message_index: { type: ["integer", "null"] },
            },
            required: ["title", "priority"],
          },
        },
        milestones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              event_at: { type: "string", description: "ISO 8601" },
              tipo: {
                type: "string",
                enum: ["positivo", "tension", "acuerdo", "incidencia", "hito", "reunion", "primer_contacto"],
              },
              score: { type: "string", enum: ["good", "neutral", "bad"] },
              title: { type: "string" },
              description: { type: "string" },
              source_message_index: { type: ["integer", "null"] },
            },
            required: ["event_at", "tipo", "score", "title"],
          },
        },
        sentiment_per_message: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "integer" },
              sentiment: { type: "string", enum: ["good", "neutral", "bad"] },
            },
            required: ["index", "sentiment"],
          },
        },
        topics: { type: "array", items: { type: "string" } },
        opportunities: { type: "array", items: { type: "string" } },
      },
      required: ["tasks", "milestones", "sentiment_per_message", "topics"],
    };

    const aiRes = await fetch(AI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Contacto: ${nombre} (${contacto.email})${contacto.empresa ? ` · ${contacto.empresa}` : ""}\n\nMensajes (más antiguos primero, índice [N]):\n\n${messagesText}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_signals",
              description: "Estructura las señales extraídas",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_signals" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      throw new Error(`AI ${aiRes.status}: ${t.slice(0, 300)}`);
    }
    const aiData = await aiRes.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No tool call in AI response");
    const result = JSON.parse(toolCall.function.arguments);

    // Persistir tasks
    let tasksCreated = 0;
    if (Array.isArray(result.tasks)) {
      for (const t of result.tasks) {
        const sourceMsgId =
          typeof t.source_message_index === "number" && messageIds[t.source_message_index]
            ? messageIds[t.source_message_index]
            : null;
        const { error: tErr } = await admin.from("contact_tasks").insert({
          owner_id: user.id,
          contact_id,
          title: t.title?.slice(0, 250) || "Tarea",
          description: t.description?.slice(0, 1000),
          due_at: t.due_at,
          priority: Math.min(5, Math.max(1, t.priority || 3)),
          source: "ai_email",
          source_message_id: sourceMsgId,
        });
        if (!tErr) tasksCreated++;
      }
    }

    // Persistir milestones
    let milestonesCreated = 0;
    if (Array.isArray(result.milestones)) {
      for (const m of result.milestones) {
        const sourceMsgId =
          typeof m.source_message_index === "number" && messageIds[m.source_message_index]
            ? messageIds[m.source_message_index]
            : null;
        const { error: mErr } = await admin.from("contact_milestones").insert({
          owner_id: user.id,
          contact_id,
          event_at: m.event_at,
          tipo: m.tipo,
          score: m.score,
          title: m.title?.slice(0, 250) || "Evento",
          description: m.description?.slice(0, 1000),
          source_message_id: sourceMsgId,
          auto_generated: true,
        });
        if (!mErr) milestonesCreated++;
      }
    }

    // Update sentiment per message
    if (Array.isArray(result.sentiment_per_message)) {
      for (const s of result.sentiment_per_message) {
        const id = messageIds[s.index];
        if (id) {
          await admin
            .from("contact_messages")
            .update({ sentiment: s.sentiment, processed_at: new Date().toISOString() })
            .eq("id", id);
        }
      }
    }
    // Marcar resto como procesados
    await admin
      .from("contact_messages")
      .update({ processed_at: new Date().toISOString() })
      .in("id", messageIds)
      .is("processed_at", null);

    // Actualizar perfil_ia con próxima acción + topics + oportunidades
    const currentProfile = (contacto.perfil_ia as any) || {};
    const updatedProfile = {
      ...currentProfile,
      proxima_accion: result.next_action || currentProfile.proxima_accion || null,
      topics_recientes: result.topics || currentProfile.topics_recientes || [],
      oportunidades: result.opportunities || currentProfile.oportunidades || [],
      generated_at: new Date().toISOString(),
    };
    await admin
      .from("contactos")
      .update({ perfil_ia: updatedProfile })
      .eq("id", contact_id);

    return new Response(
      JSON.stringify({
        success: true,
        processed: msgs.length,
        tasks_created: tasksCreated,
        milestones_created: milestonesCreated,
        next_action: result.next_action,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("contact-extract-signals error:", e);
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
