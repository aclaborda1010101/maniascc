// email-classify-journal
// Consume public.email_ingest_queue (status='pending'), clasifica cada item
// (owner, contactos, hilo, patrones, match determinista, vínculos, LLM), y
// aplica la clasificación en el modelo de negocio o la envía a needs_review.
//
// Auth: verify_jwt=false + service-role key o JWT admin/gestor.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set([
  "de","la","el","los","las","del","por","para","con","sin","que","como","una","uno","este","esta","estos","estas","sus","sobre","hacia","desde","entre","cada","muy","son","fue","han","era","ser","fwd","re","rv","aviso","correo","email","gracias","saludos","buenos","dias","tardes","hola","adjunto","adjunta"
]);

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
function sanitizePath(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._\- ]/g, "_").replace(/\s+/g, " ").slice(0, 120).trim() || "sin_nombre";
}

async function checkAuth(req: Request, supabase: any): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (svc && auth === `Bearer ${svc}`) return true;
  const tok = auth.replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  const { data, error } = await supabase.auth.getClaims(tok);
  if (error || !data?.claims?.sub) return false;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.claims.sub);
  return (roles || []).some((r: any) => r.role === "admin" || r.role === "gestor");
}

async function graphToken(): Promise<string | null> {
  const tenant = Deno.env.get("M365_TENANT_ID");
  const clientId = Deno.env.get("M365_CLIENT_ID");
  const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
  if (!tenant || !clientId || !clientSecret) return null;
  const body = new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });
  const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.access_token as string;
}

// ─── Pipeline ────────────────────────────────────────────────────────────────

interface Classification {
  proyecto_id?: string | null;
  operador_id?: string | null;
  contacto_ids?: string[];
  categoria?: string;
  confianza: number;
  resumen?: string;
  motivo?: string;
  fuente_clasificacion: string;
  es_relevante?: boolean;
}

async function classifyItem(supabase: any, item: any, ctx: { proyectos: any[]; operadores: any[]; adminId: string; umbral: number; }): Promise<{ owner_id: string; contact_ids: string[]; classification: Classification; }> {
  const allEmails = [item.from_email, ...(item.to_emails || []), ...(item.cc_emails || [])].filter(Boolean).map((e: string) => e.toLowerCase());

  // (a) owner
  const { data: perfiles } = await supabase.from("perfiles").select("user_id,email").in("email", allEmails);
  const ownerRow = (perfiles || [])[0];
  const owner_id = ownerRow?.user_id || ctx.adminId;

  // (b) contactos
  const { data: contactos } = await supabase.from("contactos").select("id,email,operador_id").in("email", allEmails);
  const contact_ids = (contactos || []).map((c: any) => c.id);
  const contactoConOperador = (contactos || []).find((c: any) => c.operador_id);

  // (c) herencia de hilo
  if (item.conversation_id) {
    const { data: prev } = await supabase
      .from("email_ingest_queue")
      .select("classification")
      .eq("conversation_id", item.conversation_id)
      .eq("status", "applied")
      .order("applied_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const pc = prev?.classification;
    if (pc && (pc.proyecto_id || pc.operador_id)) {
      return {
        owner_id, contact_ids,
        classification: {
          proyecto_id: pc.proyecto_id || null,
          operador_id: pc.operador_id || null,
          contacto_ids: contact_ids,
          categoria: pc.categoria || "otro",
          confianza: 0.95,
          resumen: `Hereda del hilo: ${item.subject}`,
          fuente_clasificacion: "hilo",
          es_relevante: true,
        },
      };
    }
  }

  // (d) patrones aprendidos
  if (item.from_email) {
    const dom = item.from_email.split("@")[1] || "";
    const keys = [item.from_email, dom].filter(Boolean);
    const { data: patrones } = await supabase
      .from("ai_learned_patterns")
      .select("patron_key,confianza,datos_agregados")
      .eq("patron_tipo", "email_classification")
      .eq("activo", true)
      .in("patron_key", keys);
    const best = (patrones || []).sort((a: any, b: any) => (b.confianza || 0) - (a.confianza || 0))[0];
    if (best) {
      const d = best.datos_agregados || {};
      return {
        owner_id, contact_ids,
        classification: {
          proyecto_id: d.proyecto_id || null,
          operador_id: d.operador_id || null,
          contacto_ids: contact_ids,
          categoria: d.categoria || "otro",
          confianza: Number(best.confianza) || 0.7,
          resumen: `Patrón aprendido: ${best.patron_key}`,
          fuente_clasificacion: "patron",
          es_relevante: true,
        },
      };
    }
  }

  // (e) match determinista proyecto por nombre
  const haystack = tokens(`${item.subject || ""} ${item.body_text || ""}`);
  const haySet = new Set(haystack);
  let bestProyecto: { id: string; nombre: string; score: number } | null = null;
  for (const p of ctx.proyectos) {
    const nameTokens = tokens(p.nombre);
    if (!nameTokens.length) continue;
    const overlap = nameTokens.filter((t) => haySet.has(t)).length;
    const ratio = overlap / nameTokens.length;
    if (ratio >= 0.6 && overlap >= 1) {
      const score = ratio + overlap / 20;
      if (!bestProyecto || score > bestProyecto.score) bestProyecto = { id: p.id, nombre: p.nombre, score };
    }
  }

  // (f) vínculos existentes
  let proyecto_id: string | null = bestProyecto?.id || null;
  let operador_id: string | null = contactoConOperador?.operador_id || null;
  let fuente = bestProyecto ? "match_determinista" : (operador_id ? "vinculos" : "");
  let confianza = bestProyecto ? Math.min(0.9, 0.7 + bestProyecto.score * 0.1) : (operador_id ? 0.7 : 0);

  if (!proyecto_id && contact_ids.length) {
    const { data: pc } = await supabase
      .from("proyecto_contactos").select("proyecto_id").in("contacto_id", contact_ids).limit(3);
    if (pc && pc.length === 1) {
      proyecto_id = pc[0].proyecto_id;
      fuente = fuente || "vinculos";
      confianza = Math.max(confianza, 0.75);
    }
  }

  if (proyecto_id && confianza >= ctx.umbral) {
    return {
      owner_id, contact_ids,
      classification: {
        proyecto_id, operador_id, contacto_ids: contact_ids,
        categoria: "otro", confianza, resumen: item.subject || "",
        fuente_clasificacion: fuente || "match_determinista", es_relevante: true,
      },
    };
  }

  // (g) LLM
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return {
      owner_id, contact_ids,
      classification: {
        proyecto_id, operador_id, contacto_ids: contact_ids,
        categoria: "otro", confianza, resumen: item.subject || "",
        fuente_clasificacion: fuente || "sin_llm", es_relevante: proyecto_id !== null,
      },
    };
  }

  const t0 = Date.now();
  const candProyectos = ctx.proyectos.slice(0, 150).map((p) => ({ id: p.id, nombre: p.nombre }));
  const candOperadores = ctx.operadores.slice(0, 150).map((o) => ({ id: o.id, nombre: o.nombre }));

  const system = "Eres un clasificador de correos corporativos de una consultora inmobiliaria. Tu tarea es asignar cada correo al proyecto y operador correctos usando los candidatos dados. Responde SIEMPRE llamando a la herramienta clasificar_correo. Sé conservador: si no hay señal clara, devuelve nulls y confianza baja.";
  const user = JSON.stringify({
    subject: item.subject,
    from: `${item.from_name || ""} <${item.from_email || ""}>`,
    to: (item.to_emails || []).slice(0, 8),
    cc: (item.cc_emails || []).slice(0, 8),
    body: (item.body_text || "").slice(0, 3000),
    candidatos_proyectos: candProyectos,
    candidatos_operadores: candOperadores,
  });

  const tool = {
    type: "function",
    function: {
      name: "clasificar_correo",
      description: "Clasifica el correo. Devuelve nulls y confianza baja si no hay señal clara.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          es_relevante: { type: "boolean", description: "false si es spam/noticias/notificación automática irrelevante para el negocio" },
          proyecto_id: { type: ["string", "null"] },
          operador_id: { type: ["string", "null"] },
          categoria: { type: "string", enum: ["negociacion","comercial","administracion","tecnico","otro"] },
          confianza: { type: "number", minimum: 0, maximum: 1 },
          resumen: { type: "string", description: "1-2 frases en español" },
        },
        required: ["es_relevante","proyecto_id","operador_id","categoria","confianza","resumen"],
      },
    },
  };

  let llmClass: any = null;
  let tokensIn = 0, tokensOut = 0, exito = true, errMsg: string | null = null;
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "clasificar_correo" } },
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`gateway [${r.status}]: ${t.slice(0, 400)}`);
    }
    const j = await r.json();
    tokensIn = j.usage?.prompt_tokens || 0;
    tokensOut = j.usage?.completion_tokens || 0;
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    if (call?.function?.arguments) {
      llmClass = JSON.parse(call.function.arguments);
    }
  } catch (e: any) {
    exito = false; errMsg = e?.message || String(e);
    console.error("[m365] LLM error:", errMsg);
  }

  await supabase.from("auditoria_ia").insert({
    funcion_ia: "email-classify",
    modelo: "google/gemini-2.5-flash",
    tokens_entrada: tokensIn,
    tokens_salida: tokensOut,
    latencia_ms: Date.now() - t0,
    exito,
    error_mensaje: errMsg,
    created_by: ctx.adminId,
  });

  if (!llmClass) {
    return {
      owner_id, contact_ids,
      classification: {
        proyecto_id, operador_id, contacto_ids: contact_ids,
        categoria: "otro", confianza, resumen: item.subject || "",
        fuente_clasificacion: fuente || "sin_llm", es_relevante: true,
      },
    };
  }

  // valida ids
  const validPid = candProyectos.some((p) => p.id === llmClass.proyecto_id) ? llmClass.proyecto_id : null;
  const validOid = candOperadores.some((o) => o.id === llmClass.operador_id) ? llmClass.operador_id : null;

  return {
    owner_id, contact_ids,
    classification: {
      proyecto_id: validPid || proyecto_id,
      operador_id: validOid || operador_id,
      contacto_ids: contact_ids,
      categoria: llmClass.categoria || "otro",
      confianza: Number(llmClass.confianza) || 0,
      resumen: llmClass.resumen || item.subject || "",
      fuente_clasificacion: "llm",
      es_relevante: llmClass.es_relevante !== false,
    },
  };
}

// ─── Aplicar clasificación ───────────────────────────────────────────────────

export async function applyClassification(supabase: any, item: any, owner_id: string, contact_ids: string[], classification: Classification, graphTokenGetter: () => Promise<string | null>) {
  const isOut = item.from_email && (await supabase.from("perfiles").select("email").eq("email", item.from_email).maybeSingle()).data ? true : false;
  const direction = isOut ? "out" : "in";
  const bodySnippet = (item.body_text || "").slice(0, 280);

  // contact_messages (dedupe idempotente)
  const principalContact = contact_ids[0] || null;
  await supabase.from("contact_messages").upsert({
    owner_id,
    contact_id: principalContact,
    channel: "email_journal",
    external_id: item.internet_message_id,
    direction,
    from_email: item.from_email,
    from_name: item.from_name,
    to_emails: item.to_emails,
    subject: item.subject,
    body_text: item.body_text,
    body_snippet: bodySnippet,
    sent_at: item.received_at,
    thread_external_id: item.conversation_id,
    metadata: {
      proyecto_id: classification.proyecto_id || null,
      operador_id: classification.operador_id || null,
      categoria: classification.categoria || null,
      confianza: classification.confianza || 0,
    },
  }, { onConflict: "owner_id,channel,external_id", ignoreDuplicates: true });

  // email_threads upsert
  if (item.conversation_id) {
    const { data: existingThread } = await supabase
      .from("email_threads")
      .select("id,message_count,participants,last_date")
      .eq("owner_id", owner_id)
      .eq("thread_external_id", item.conversation_id)
      .maybeSingle();
    const participantsSet = new Set<string>([
      ...(existingThread?.participants || []).map((p: any) => typeof p === "string" ? p : p.email),
      item.from_email,
      ...(item.to_emails || []),
    ].filter(Boolean));
    const participants = Array.from(participantsSet).map((e) => ({ email: e }));
    if (existingThread) {
      const newLast = !existingThread.last_date || item.received_at > existingThread.last_date ? item.received_at : existingThread.last_date;
      await supabase.from("email_threads").update({
        message_count: (existingThread.message_count || 1) + 1,
        participants,
        last_date: newLast,
        summary: classification.resumen || undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", existingThread.id);
    } else {
      const { data: newThread } = await supabase.from("email_threads").insert({
        owner_id,
        thread_external_id: item.conversation_id,
        subject: item.subject,
        participants,
        first_date: item.received_at,
        last_date: item.received_at,
        message_count: 1,
        summary: classification.resumen || null,
        metadata: { origen: "email_journal" },
      }).select("id").single();

      // email_entities
      if (newThread) {
        const entities = [];
        if (classification.proyecto_id) entities.push({ thread_id: newThread.id, owner_id, entity_type: "proyecto", entity_id: classification.proyecto_id, entity_name_raw: "proyecto", confidence: classification.confianza });
        if (classification.operador_id) entities.push({ thread_id: newThread.id, owner_id, entity_type: "operador", entity_id: classification.operador_id, entity_name_raw: "operador", confidence: classification.confianza });
        if (entities.length) await supabase.from("email_entities").insert(entities);
      }
    }
  }

  // last_contact
  if (principalContact) {
    await supabase.from("contactos").update({ last_contact: item.received_at }).eq("id", principalContact);
  }

  // Adjuntos (solo con proyecto)
  if (item.has_attachments && classification.proyecto_id) {
    try {
      const token = await graphTokenGetter();
      const mailbox = Deno.env.get("M365_JOURNAL_MAILBOX");
      if (token && mailbox) {
        const { data: proyecto } = await supabase.from("proyectos").select("nombre").eq("id", classification.proyecto_id).maybeSingle();
        const projName = sanitizePath(proyecto?.nombre || classification.proyecto_id);

        const ar = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages/${item.graph_message_id}/attachments`, { headers: { Authorization: `Bearer ${token}` } });
        if (ar.ok) {
          const aj = await ar.json();
          for (const att of (aj.value || [])) {
            if (att.isInline) continue;
            if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
            if ((att.contentType || "").startsWith("image/") && (att.size || 0) < 20000) continue;

            // dedupe
            const { data: dup } = await supabase.from("documentos_proyecto")
              .select("id").eq("origen", "email_journal").eq("origen_external_id", att.id).maybeSingle();
            if (dup) continue;

            const filename = sanitizePath(att.name || "adjunto");
            const bytes = Uint8Array.from(atob(att.contentBytes), (c) => c.charCodeAt(0));
            const storagePath = `proyectos/${classification.proyecto_id}/email/${Date.now()}_${filename}`;

            const { error: upErr } = await supabase.storage.from("documentos_contratos").upload(storagePath, bytes, { contentType: att.contentType || "application/octet-stream", upsert: false });
            if (upErr) { console.error("[m365] storage upload:", upErr.message); continue; }

            // OneDrive del buzón
            fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/drive/root:/AVA/Proyectos/${encodeURIComponent(projName)}/${encodeURIComponent(filename)}:/content`, {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": att.contentType || "application/octet-stream" },
              body: bytes,
            }).catch((e) => console.error("[m365] onedrive:", e));

            const { data: doc } = await supabase.from("documentos_proyecto").insert({
              proyecto_id: classification.proyecto_id,
              nombre: filename,
              storage_path: storagePath,
              mime_type: att.contentType,
              tamano_bytes: att.size,
              owner_id,
              visibility: "shared",
              origen: "email_journal",
              origen_external_id: att.id,
              dominio: classification.categoria || null,
              fase_rag: "pending",
              metadata_extraida: { email_subject: item.subject, from: item.from_email },
            }).select("id").single();

            if (doc) {
              const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
              fetch(`${base}/functions/v1/rag-ingest`, {
                method: "POST",
                headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" },
                body: JSON.stringify({ documento_id: doc.id }),
              }).catch((e) => console.error("[m365] rag-ingest:", e));
            }
          }
        } else {
          console.error(`[m365] attachments fetch [${ar.status}]`);
        }
      }
    } catch (e: any) {
      console.error("[m365] attachments error:", e?.message);
    }
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const ok = await checkAuth(req, supabase);
    if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Manual apply desde bandeja: { item_id, classification, action: 'apply' }
    let payload: any = {};
    try { payload = await req.json(); } catch { /* empty */ }

    const { data: settings } = await supabase.from("email_classifier_settings").select("umbral_auto,activo").limit(1).maybeSingle();
    const umbral = Number(settings?.umbral_auto ?? 0.80);
    if (settings && settings.activo === false && !payload.item_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "clasificador inactivo" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    const adminId = admins?.[0]?.user_id;
    if (!adminId) return new Response(JSON.stringify({ error: "sin admin" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Precarga catálogos
    const [{ data: proyectos }, { data: operadores }] = await Promise.all([
      supabase.from("proyectos").select("id,nombre").order("created_at", { ascending: false }).limit(300),
      supabase.from("operadores").select("id,nombre").order("nombre").limit(300),
    ]);
    const ctx = { proyectos: proyectos || [], operadores: operadores || [], adminId, umbral };

    // Modo manual (bandeja)
    if (payload.item_id && payload.classification) {
      const { data: item } = await supabase.from("email_ingest_queue").select("*").eq("id", payload.item_id).maybeSingle();
      if (!item) return new Response(JSON.stringify({ error: "item no existe" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const owner_id = payload.owner_id || adminId;
      const contact_ids = payload.contact_ids || [];
      await applyClassification(supabase, item, owner_id, contact_ids, payload.classification, graphToken);
      await supabase.from("email_ingest_queue").update({ status: "applied", applied_at: new Date().toISOString(), classification: payload.classification }).eq("id", item.id);
      return new Response(JSON.stringify({ ok: true, applied: 1 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Batch pending
    const { data: items } = await supabase.from("email_ingest_queue").select("*").eq("status", "pending").order("received_at", { ascending: true }).limit(20);
    console.log(`[m365-classify] batch=${items?.length || 0}`);

    let applied = 0, review = 0, discarded = 0, errored = 0;

    for (const item of (items || [])) {
      try {
        const { owner_id, contact_ids, classification } = await classifyItem(supabase, item, ctx);

        if (classification.es_relevante === false) {
          await supabase.from("email_ingest_queue").update({ status: "discarded", classification }).eq("id", item.id);
          discarded++;
          continue;
        }
        if (classification.confianza >= umbral) {
          await applyClassification(supabase, item, owner_id, contact_ids, classification, graphToken);
          await supabase.from("email_ingest_queue").update({ status: "applied", applied_at: new Date().toISOString(), classification }).eq("id", item.id);
          applied++;
        } else {
          await supabase.from("email_ingest_queue").update({ status: "needs_review", classification }).eq("id", item.id);
          review++;
        }
      } catch (e: any) {
        console.error(`[m365-classify] item ${item.id}:`, e?.message);
        await supabase.from("email_ingest_queue").update({ status: "error", error_msg: (e?.message || String(e)).slice(0, 500) }).eq("id", item.id);
        errored++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: items?.length || 0, applied, review, discarded, errored }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[m365-classify] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
