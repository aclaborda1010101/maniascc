// email-classify-journal
// Consume email_ingest_queue (status='pending') y aplica clasificación.
// - Match determinista contra proyectos y project_aliases (normalizado)
// - Doble umbral: >=umbral_auto aplica; >=umbral_revision needs_review con propuesta; < umbral_revision needs_review sin propuesta
// - Asignación: al needs_review, se asigna al interno implicado (from, luego to, luego cc, luego routing patterns aprendidos)
// - Adjuntos: dedup por hash MD5 en el mismo proyecto (documentos_proyecto.hash_md5)
// - Manual: {item_id, classification, action:'apply', assigned_to?, apply_to_thread?}
//            {item_id, action:'derive', new_assignee}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STOPWORDS = new Set(["de","la","el","los","las","del","por","para","con","sin","que","como","una","uno","este","esta","estos","estas","sus","sobre","hacia","desde","entre","cada","muy","son","fue","han","era","ser","fwd","re","rv","aviso","correo","email","gracias","saludos","buenos","dias","tardes","hola","adjunto","adjunta"]);

function normalize(s: string): string {
  return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}
function sanitizePath(s: string): string {
  return (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9._\- ]/g, "_").replace(/\s+/g, " ").slice(0, 120).trim() || "sin_nombre";
}
async function md5Hex(bytes: Uint8Array): Promise<string> {
  // Deno soporta MD5 vía crypto.subtle? No. Uso implementación mínima via std/hash o SHA1 fallback? Uso crypto.subtle SHA-256 no cumple.
  // Deno crypto: no MD5 nativo. Implemento MD5 puro.
  return md5(bytes);
}

// ── MD5 puro (RFC 1321) ─────────────────────────────────────────
function md5(input: Uint8Array): string {
  function rhex(n: number) { const s = "0123456789abcdef"; let r = ""; for (let i = 0; i < 4; i++) r += s[(n >> (i * 8 + 4)) & 0x0f] + s[(n >> (i * 8)) & 0x0f]; return r; }
  function add32(a: number, b: number) { return (a + b) & 0xffffffff; }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) { a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b); }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
  const n = input.length;
  const nblk = ((n + 8) >> 6) + 1;
  const blks = new Array(nblk * 16).fill(0);
  for (let i = 0; i < n; i++) blks[i >> 2] |= input[i] << ((i % 4) * 8);
  blks[n >> 2] |= 0x80 << ((n % 4) * 8);
  blks[nblk * 16 - 2] = n * 8;
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  for (let i = 0; i < blks.length; i += 16) {
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, blks[i + 0], 7, -680876936); d = ff(d, a, b, c, blks[i + 1], 12, -389564586); c = ff(c, d, a, b, blks[i + 2], 17, 606105819); b = ff(b, c, d, a, blks[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, blks[i + 4], 7, -176418897); d = ff(d, a, b, c, blks[i + 5], 12, 1200080426); c = ff(c, d, a, b, blks[i + 6], 17, -1473231341); b = ff(b, c, d, a, blks[i + 7], 22, -45705983);
    a = ff(a, b, c, d, blks[i + 8], 7, 1770035416); d = ff(d, a, b, c, blks[i + 9], 12, -1958414417); c = ff(c, d, a, b, blks[i + 10], 17, -42063); b = ff(b, c, d, a, blks[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, blks[i + 12], 7, 1804603682); d = ff(d, a, b, c, blks[i + 13], 12, -40341101); c = ff(c, d, a, b, blks[i + 14], 17, -1502002290); b = ff(b, c, d, a, blks[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, blks[i + 1], 5, -165796510); d = gg(d, a, b, c, blks[i + 6], 9, -1069501632); c = gg(c, d, a, b, blks[i + 11], 14, 643717713); b = gg(b, c, d, a, blks[i + 0], 20, -373897302);
    a = gg(a, b, c, d, blks[i + 5], 5, -701558691); d = gg(d, a, b, c, blks[i + 10], 9, 38016083); c = gg(c, d, a, b, blks[i + 15], 14, -660478335); b = gg(b, c, d, a, blks[i + 4], 20, -405537848);
    a = gg(a, b, c, d, blks[i + 9], 5, 568446438); d = gg(d, a, b, c, blks[i + 14], 9, -1019803690); c = gg(c, d, a, b, blks[i + 3], 14, -187363961); b = gg(b, c, d, a, blks[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, blks[i + 13], 5, -1444681467); d = gg(d, a, b, c, blks[i + 2], 9, -51403784); c = gg(c, d, a, b, blks[i + 7], 14, 1735328473); b = gg(b, c, d, a, blks[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, blks[i + 5], 4, -378558); d = hh(d, a, b, c, blks[i + 8], 11, -2022574463); c = hh(c, d, a, b, blks[i + 11], 16, 1839030562); b = hh(b, c, d, a, blks[i + 14], 23, -35309556);
    a = hh(a, b, c, d, blks[i + 1], 4, -1530992060); d = hh(d, a, b, c, blks[i + 4], 11, 1272893353); c = hh(c, d, a, b, blks[i + 7], 16, -155497632); b = hh(b, c, d, a, blks[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, blks[i + 13], 4, 681279174); d = hh(d, a, b, c, blks[i + 0], 11, -358537222); c = hh(c, d, a, b, blks[i + 3], 16, -722521979); b = hh(b, c, d, a, blks[i + 6], 23, 76029189);
    a = hh(a, b, c, d, blks[i + 9], 4, -640364487); d = hh(d, a, b, c, blks[i + 12], 11, -421815835); c = hh(c, d, a, b, blks[i + 15], 16, 530742520); b = hh(b, c, d, a, blks[i + 2], 23, -995338651);
    a = ii(a, b, c, d, blks[i + 0], 6, -198630844); d = ii(d, a, b, c, blks[i + 7], 10, 1126891415); c = ii(c, d, a, b, blks[i + 14], 15, -1416354905); b = ii(b, c, d, a, blks[i + 5], 21, -57434055);
    a = ii(a, b, c, d, blks[i + 12], 6, 1700485571); d = ii(d, a, b, c, blks[i + 3], 10, -1894986606); c = ii(c, d, a, b, blks[i + 10], 15, -1051523); b = ii(b, c, d, a, blks[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, blks[i + 8], 6, 1873313359); d = ii(d, a, b, c, blks[i + 15], 10, -30611744); c = ii(c, d, a, b, blks[i + 6], 15, -1560198380); b = ii(b, c, d, a, blks[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, blks[i + 4], 6, -145523070); d = ii(d, a, b, c, blks[i + 11], 10, -1120210379); c = ii(c, d, a, b, blks[i + 2], 15, 718787259); b = ii(b, c, d, a, blks[i + 9], 21, -343485551);
    a = add32(a, oa); b = add32(b, ob); c = add32(c, oc); d = add32(d, od);
  }
  return rhex(a) + rhex(b) + rhex(c) + rhex(d);
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

async function loadM365(supabase: any) {
  const { data: cfg } = await supabase.from("email_classifier_settings")
    .select("m365_tenant_id,m365_client_id,m365_client_secret,m365_journal_mailbox").limit(1).maybeSingle();
  const tenant = cfg?.m365_tenant_id || Deno.env.get("M365_TENANT_ID");
  const clientId = cfg?.m365_client_id || Deno.env.get("M365_CLIENT_ID");
  const clientSecret = cfg?.m365_client_secret || Deno.env.get("M365_CLIENT_SECRET");
  const mailbox = cfg?.m365_journal_mailbox || Deno.env.get("M365_JOURNAL_MAILBOX");
  if (!tenant || !clientId || !clientSecret || !mailbox) return null;
  return { tenant, clientId, clientSecret, mailbox };
}

async function graphTokenFromCfg(): Promise<{ token: string; mailbox: string } | null> {
  // best-effort para adjuntos
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const cfg = await loadM365(supa);
  if (!cfg) return null;
  const body = new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" });
  const r = await fetch(`https://login.microsoftonline.com/${cfg.tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) return null;
  const j = await r.json();
  return { token: j.access_token, mailbox: cfg.mailbox };
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

async function classifyItem(supabase: any, item: any, ctx: { proyectos: any[]; aliases: { proyecto_id: string; alias_norm: string }[]; operadores: any[]; adminId: string; umbralAuto: number; umbralRev: number; }): Promise<{ owner_id: string; contact_ids: string[]; classification: Classification; }> {
  const allEmails = [item.from_email, ...(item.to_emails || []), ...(item.cc_emails || [])].filter(Boolean).map((e: string) => e.toLowerCase());

  const { data: perfiles } = await supabase.from("perfiles").select("user_id,email").in("email", allEmails);
  const ownerRow = (perfiles || [])[0];
  const owner_id = ownerRow?.user_id || ctx.adminId;

  const { data: contactos } = await supabase.from("contactos").select("id,email,operador_id").in("email", allEmails);
  const contact_ids = (contactos || []).map((c: any) => c.id);
  const contactoConOperador = (contactos || []).find((c: any) => c.operador_id);

  // Herencia de hilo
  if (item.conversation_id) {
    const { data: prev } = await supabase.from("email_ingest_queue").select("classification").eq("conversation_id", item.conversation_id).eq("status", "applied").order("applied_at", { ascending: false }).limit(1).maybeSingle();
    const pc = prev?.classification;
    if (pc && (pc.proyecto_id || pc.operador_id)) {
      return { owner_id, contact_ids, classification: { proyecto_id: pc.proyecto_id || null, operador_id: pc.operador_id || null, contacto_ids: contact_ids, categoria: pc.categoria || "otro", confianza: 0.95, resumen: `Hereda del hilo: ${item.subject}`, fuente_clasificacion: "hilo", es_relevante: true } };
    }
  }

  // Patrones aprendidos (clasificación)
  if (item.from_email) {
    const dom = item.from_email.split("@")[1] || "";
    const keys = [item.from_email, dom].filter(Boolean);
    const { data: patrones } = await supabase.from("ai_learned_patterns").select("patron_key,confianza,datos_agregados").eq("patron_tipo", "email_classification").eq("activo", true).in("patron_key", keys);
    const best = (patrones || []).sort((a: any, b: any) => (b.confianza || 0) - (a.confianza || 0))[0];
    if (best) {
      const d = best.datos_agregados || {};
      return { owner_id, contact_ids, classification: { proyecto_id: d.proyecto_id || null, operador_id: d.operador_id || null, contacto_ids: contact_ids, categoria: d.categoria || "otro", confianza: Number(best.confianza) || 0.7, resumen: `Patrón aprendido: ${best.patron_key}`, fuente_clasificacion: "patron", es_relevante: true } };
    }
  }

  // Match determinista: proyectos + aliases
  const hayNorm = normalize(`${item.subject || ""} ${item.body_text || ""}`);
  const haystack = tokens(hayNorm);
  const haySet = new Set(haystack);
  let bestProyecto: { id: string; nombre: string; score: number; via: string } | null = null;

  // Aliases: substring match sobre texto normalizado
  for (const al of ctx.aliases) {
    if (al.alias_norm.length < 3) continue;
    if (hayNorm.includes(al.alias_norm)) {
      const score = 0.95;
      if (!bestProyecto || score > bestProyecto.score) {
        const p = ctx.proyectos.find((x) => x.id === al.proyecto_id);
        if (p) bestProyecto = { id: p.id, nombre: p.nombre, score, via: "alias" };
      }
    }
  }
  // Nombre del proyecto (tokens)
  if (!bestProyecto) {
    for (const p of ctx.proyectos) {
      const nameTokens = tokens(p.nombre);
      if (!nameTokens.length) continue;
      const overlap = nameTokens.filter((t) => haySet.has(t)).length;
      const ratio = overlap / nameTokens.length;
      if (ratio >= 0.6 && overlap >= 1) {
        const score = ratio + overlap / 20;
        if (!bestProyecto || score > bestProyecto.score) bestProyecto = { id: p.id, nombre: p.nombre, score, via: "nombre" };
      }
    }
  }

  let proyecto_id: string | null = bestProyecto?.id || null;
  let operador_id: string | null = contactoConOperador?.operador_id || null;
  let fuente = bestProyecto ? `match_${bestProyecto.via}` : (operador_id ? "vinculos" : "");
  let confianza = bestProyecto ? Math.min(0.95, 0.75 + bestProyecto.score * 0.1) : (operador_id ? 0.7 : 0);

  if (!proyecto_id && contact_ids.length) {
    const { data: pc } = await supabase.from("proyecto_contactos").select("proyecto_id").in("contacto_id", contact_ids).limit(3);
    if (pc && pc.length === 1) { proyecto_id = pc[0].proyecto_id; fuente = fuente || "vinculos"; confianza = Math.max(confianza, 0.75); }
  }

  if (proyecto_id && confianza >= ctx.umbralAuto) {
    return { owner_id, contact_ids, classification: { proyecto_id, operador_id, contacto_ids: contact_ids, categoria: "otro", confianza, resumen: item.subject || "", fuente_clasificacion: fuente || "match_determinista", es_relevante: true } };
  }

  // LLM
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return { owner_id, contact_ids, classification: { proyecto_id, operador_id, contacto_ids: contact_ids, categoria: "otro", confianza, resumen: item.subject || "", fuente_clasificacion: fuente || "sin_llm", es_relevante: proyecto_id !== null } };
  }

  const t0 = Date.now();
  const candProyectos = ctx.proyectos.slice(0, 150).map((p) => ({ id: p.id, nombre: p.nombre }));
  const candOperadores = ctx.operadores.slice(0, 150).map((o) => ({ id: o.id, nombre: o.nombre }));

  const system = "Eres un clasificador de correos corporativos de una consultora inmobiliaria. Asigna cada correo al proyecto y operador correctos entre los candidatos dados. Llama SIEMPRE a la herramienta clasificar_correo. Sé conservador: si no hay señal clara, devuelve nulls y confianza baja.";
  const user = JSON.stringify({
    subject: item.subject, from: `${item.from_name || ""} <${item.from_email || ""}>`,
    to: (item.to_emails || []).slice(0, 8), cc: (item.cc_emails || []).slice(0, 8),
    body: (item.body_text || "").slice(0, 3000),
    candidatos_proyectos: candProyectos, candidatos_operadores: candOperadores,
  });

  const tool = {
    type: "function",
    function: {
      name: "clasificar_correo",
      description: "Clasifica el correo. Devuelve nulls y confianza baja si no hay señal clara.",
      parameters: {
        type: "object", additionalProperties: false,
        properties: {
          es_relevante: { type: "boolean" },
          proyecto_id: { type: ["string", "null"] },
          operador_id: { type: ["string", "null"] },
          categoria: { type: "string", enum: ["negociacion","comercial","administracion","tecnico","otro"] },
          confianza: { type: "number", minimum: 0, maximum: 1 },
          resumen: { type: "string" },
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
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "system", content: system }, { role: "user", content: user }], tools: [tool], tool_choice: { type: "function", function: { name: "clasificar_correo" } } }),
    });
    if (!r.ok) { const t = await r.text(); throw new Error(`gateway [${r.status}]: ${t.slice(0, 400)}`); }
    const j = await r.json();
    tokensIn = j.usage?.prompt_tokens || 0;
    tokensOut = j.usage?.completion_tokens || 0;
    const call = j.choices?.[0]?.message?.tool_calls?.[0];
    if (call?.function?.arguments) llmClass = JSON.parse(call.function.arguments);
  } catch (e: any) { exito = false; errMsg = e?.message || String(e); console.error("[classify] LLM error:", errMsg); }

  await supabase.from("auditoria_ia").insert({ funcion_ia: "email-classify", modelo: "google/gemini-2.5-flash", tokens_entrada: tokensIn, tokens_salida: tokensOut, latencia_ms: Date.now() - t0, exito, error_mensaje: errMsg, created_by: ctx.adminId });

  if (!llmClass) {
    return { owner_id, contact_ids, classification: { proyecto_id, operador_id, contacto_ids: contact_ids, categoria: "otro", confianza, resumen: item.subject || "", fuente_clasificacion: fuente || "sin_llm", es_relevante: true } };
  }

  const validPid = candProyectos.some((p) => p.id === llmClass.proyecto_id) ? llmClass.proyecto_id : null;
  const validOid = candOperadores.some((o) => o.id === llmClass.operador_id) ? llmClass.operador_id : null;

  return {
    owner_id, contact_ids,
    classification: {
      proyecto_id: validPid || proyecto_id, operador_id: validOid || operador_id, contacto_ids: contact_ids,
      categoria: llmClass.categoria || "otro", confianza: Number(llmClass.confianza) || 0,
      resumen: llmClass.resumen || item.subject || "",
      fuente_clasificacion: "llm", es_relevante: llmClass.es_relevante !== false,
    },
  };
}

// ─── Asignación de revisión ──────────────────────────────────────────────────
async function resolveAssignee(supabase: any, item: any): Promise<string | null> {
  // 1) from si es interno
  if (item.from_email) {
    const { data } = await supabase.from("perfiles").select("user_id").eq("email", item.from_email).maybeSingle();
    if (data?.user_id) return data.user_id;
  }
  // 2) primer to/cc interno
  const cand = [...(item.to_emails || []), ...(item.cc_emails || [])].filter(Boolean);
  if (cand.length) {
    const { data } = await supabase.from("perfiles").select("user_id,email").in("email", cand);
    if (data?.length) {
      // preserva orden
      for (const e of cand) { const hit = data.find((p: any) => p.email === e); if (hit) return hit.user_id; }
    }
  }
  // 3) patrón de enrutamiento aprendido
  if (item.from_email) {
    const dom = item.from_email.split("@")[1] || "";
    const keys = [item.from_email, dom].filter(Boolean);
    const { data: pats } = await supabase.from("ai_learned_patterns").select("datos_agregados,confianza").eq("patron_tipo", "email_routing").eq("activo", true).in("patron_key", keys);
    const best = (pats || []).sort((a: any, b: any) => (b.confianza || 0) - (a.confianza || 0))[0];
    if (best?.datos_agregados?.user_id) return best.datos_agregados.user_id as string;
  }
  return null;
}

// ─── Aplicar clasificación ───────────────────────────────────────────────────
export async function applyClassification(supabase: any, item: any, owner_id: string, contact_ids: string[], classification: Classification) {
  const isOut = item.from_email ? !!(await supabase.from("perfiles").select("email").eq("email", item.from_email).maybeSingle()).data : false;
  const direction = isOut ? "out" : "in";
  const bodySnippet = (item.body_text || "").slice(0, 280);
  const principalContact = contact_ids[0] || null;

  await supabase.from("contact_messages").upsert({
    owner_id, contact_id: principalContact, channel: "email_journal",
    external_id: item.internet_message_id, direction,
    from_email: item.from_email, from_name: item.from_name, to_emails: item.to_emails,
    subject: item.subject, body_text: item.body_text, body_snippet: bodySnippet,
    sent_at: item.received_at, thread_external_id: item.conversation_id,
    metadata: { proyecto_id: classification.proyecto_id || null, operador_id: classification.operador_id || null, categoria: classification.categoria || null, confianza: classification.confianza || 0 },
  }, { onConflict: "owner_id,channel,external_id", ignoreDuplicates: true });

  if (item.conversation_id) {
    const { data: existingThread } = await supabase.from("email_threads").select("id,message_count,participants,last_date").eq("owner_id", owner_id).eq("thread_external_id", item.conversation_id).maybeSingle();
    const participantsSet = new Set<string>([...(existingThread?.participants || []).map((p: any) => typeof p === "string" ? p : p.email), item.from_email, ...(item.to_emails || [])].filter(Boolean));
    const participants = Array.from(participantsSet).map((e) => ({ email: e }));
    if (existingThread) {
      const newLast = !existingThread.last_date || item.received_at > existingThread.last_date ? item.received_at : existingThread.last_date;
      await supabase.from("email_threads").update({ message_count: (existingThread.message_count || 1) + 1, participants, last_date: newLast, summary: classification.resumen || undefined, updated_at: new Date().toISOString() }).eq("id", existingThread.id);
    } else {
      const { data: newThread } = await supabase.from("email_threads").insert({ owner_id, thread_external_id: item.conversation_id, subject: item.subject, participants, first_date: item.received_at, last_date: item.received_at, message_count: 1, summary: classification.resumen || null, metadata: { origen: "email_journal" } }).select("id").single();
      if (newThread) {
        const entities: any[] = [];
        if (classification.proyecto_id) entities.push({ thread_id: newThread.id, owner_id, entity_type: "proyecto", entity_id: classification.proyecto_id, entity_name_raw: "proyecto", confidence: classification.confianza });
        if (classification.operador_id) entities.push({ thread_id: newThread.id, owner_id, entity_type: "operador", entity_id: classification.operador_id, entity_name_raw: "operador", confidence: classification.confianza });
        if (entities.length) await supabase.from("email_entities").insert(entities);
      }
    }
  }

  if (principalContact) await supabase.from("contactos").update({ last_contact: item.received_at }).eq("id", principalContact);

  // Adjuntos con dedup por hash MD5
  if (item.has_attachments && classification.proyecto_id) {
    try {
      const tok = await graphTokenFromCfg();
      if (!tok) return;
      const { data: proyecto } = await supabase.from("proyectos").select("nombre").eq("id", classification.proyecto_id).maybeSingle();
      const projName = sanitizePath(proyecto?.nombre || classification.proyecto_id);
      const ar = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(tok.mailbox)}/messages/${item.graph_message_id}/attachments`, { headers: { Authorization: `Bearer ${tok.token}` } });
      if (!ar.ok) { console.error(`[classify] attachments fetch [${ar.status}]`); return; }
      const aj = await ar.json();
      for (const att of (aj.value || [])) {
        if (att.isInline) continue;
        if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue;
        if ((att.contentType || "").startsWith("image/") && (att.size || 0) < 20000) continue;

        const bytes = Uint8Array.from(atob(att.contentBytes), (c) => c.charCodeAt(0));
        const hash = await md5Hex(bytes);

        // Dedup por hash en el mismo proyecto
        const { data: dupHash } = await supabase.from("documentos_proyecto").select("id").eq("proyecto_id", classification.proyecto_id).eq("hash_md5", hash).maybeSingle();
        if (dupHash) { console.log(`[classify] dedup por hash md5 en proyecto`); continue; }
        // Dedup por origen_external_id
        const { data: dupExt } = await supabase.from("documentos_proyecto").select("id").eq("origen", "email_journal").eq("origen_external_id", att.id).maybeSingle();
        if (dupExt) continue;

        const filename = sanitizePath(att.name || "adjunto");
        const storagePath = `proyectos/${classification.proyecto_id}/email/${Date.now()}_${filename}`;
        const { error: upErr } = await supabase.storage.from("documentos_contratos").upload(storagePath, bytes, { contentType: att.contentType || "application/octet-stream", upsert: false });
        if (upErr) { console.error("[classify] storage upload:", upErr.message); continue; }

        fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(tok.mailbox)}/drive/root:/AVA/Proyectos/${encodeURIComponent(projName)}/${encodeURIComponent(filename)}:/content`, {
          method: "PUT", headers: { Authorization: `Bearer ${tok.token}`, "Content-Type": att.contentType || "application/octet-stream" }, body: bytes,
        }).catch((e) => console.error("[classify] onedrive:", e));

        const { data: doc } = await supabase.from("documentos_proyecto").insert({
          proyecto_id: classification.proyecto_id, nombre: filename, storage_path: storagePath,
          mime_type: att.contentType, tamano_bytes: att.size, hash_md5: hash,
          owner_id, visibility: "shared", origen: "email_journal", origen_external_id: att.id,
          dominio: classification.categoria || null, fase_rag: "pending",
          metadata_extraida: { email_subject: item.subject, from: item.from_email },
        }).select("id").single();

        if (doc) {
          const base = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
          fetch(`${base}/functions/v1/rag-ingest`, { method: "POST", headers: { Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify({ documento_id: doc.id }) }).catch((e) => console.error("[classify] rag-ingest:", e));
        }
      }
    } catch (e: any) { console.error("[classify] attachments error:", e?.message); }
  }
}

async function notifyAssignee(supabase: any, userId: string, item: any) {
  if (!userId) return;
  await supabase.from("notificaciones").insert({
    user_id: userId, type: "email_review",
    title: "AVA necesita tu ayuda para clasificar un correo",
    description: `Estás implicado en: ${item.subject || "(sin asunto)"}`,
    link: `/bandeja-correo?item=${item.id}`,
  });
}

// ─── Handler ────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const ok = await checkAuth(req, supabase);
    if (!ok) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let payload: any = {};
    try { payload = await req.json(); } catch { /* empty */ }

    const { data: settings } = await supabase.from("email_classifier_settings").select("umbral_auto,umbral_revision,activo").limit(1).maybeSingle();
    const umbralAuto = Number(settings?.umbral_auto ?? 0.85);
    const umbralRev = Number(settings?.umbral_revision ?? 0.60);
    if (settings && settings.activo === false && !payload.item_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "clasificador inactivo" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin").limit(1);
    const adminId = admins?.[0]?.user_id;
    if (!adminId) return new Response(JSON.stringify({ error: "sin admin" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ── Acción manual: derivar ────────────────────────
    if (payload.action === "derive" && payload.item_id && payload.new_assignee) {
      const { data: item } = await supabase.from("email_ingest_queue").select("id,from_email,subject,assigned_to,derived_from").eq("id", payload.item_id).maybeSingle();
      if (!item) return new Response(JSON.stringify({ error: "item no existe" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const derivedFrom = item.assigned_to || null;
      await supabase.from("email_ingest_queue").update({ assigned_to: payload.new_assignee, assigned_at: new Date().toISOString(), derived_from: derivedFrom }).eq("id", item.id);
      await notifyAssignee(supabase, payload.new_assignee, { id: item.id, subject: `[Derivado] ${item.subject || "(sin asunto)"}` });
      // Aprende enrutamiento
      if (item.from_email) {
        const dom = item.from_email.split("@")[1] || "";
        await supabase.from("ai_learned_patterns").upsert({
          patron_tipo: "email_routing", patron_key: item.from_email,
          patron_descripcion: `Enrutar remitente ${item.from_email} → user ${payload.new_assignee}`,
          confianza: 0.75, num_observaciones: 1, datos_agregados: { user_id: payload.new_assignee, dominio: dom }, activo: true,
        }, { onConflict: "patron_tipo,patron_key" });
      }
      return new Response(JSON.stringify({ ok: true, derived: 1 }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Precarga catálogos (para modo manual y batch)
    const [{ data: proyectos }, { data: operadores }, { data: aliasesRaw }] = await Promise.all([
      supabase.from("proyectos").select("id,nombre").order("created_at", { ascending: false }).limit(300),
      supabase.from("operadores").select("id,nombre").order("nombre").limit(300),
      supabase.from("project_aliases").select("proyecto_id,alias"),
    ]);
    const aliases = (aliasesRaw || []).map((a: any) => ({ proyecto_id: a.proyecto_id, alias_norm: normalize(a.alias) }));
    const ctx = { proyectos: proyectos || [], operadores: operadores || [], aliases, adminId, umbralAuto, umbralRev };

    // ── Acción manual: aplicar clasificación (bandeja) ────────
    if (payload.item_id && payload.classification) {
      const { data: item } = await supabase.from("email_ingest_queue").select("*").eq("id", payload.item_id).maybeSingle();
      if (!item) return new Response(JSON.stringify({ error: "item no existe" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const owner_id = payload.owner_id || adminId;
      const contact_ids = payload.contact_ids || [];
      await applyClassification(supabase, item, owner_id, contact_ids, payload.classification);
      await supabase.from("email_ingest_queue").update({ status: "applied", applied_at: new Date().toISOString(), classification: payload.classification }).eq("id", item.id);

      let threadApplied = 0;
      if (payload.apply_to_thread && item.conversation_id) {
        const { data: siblings } = await supabase.from("email_ingest_queue").select("*").eq("conversation_id", item.conversation_id).eq("status", "needs_review").neq("id", item.id);
        for (const sib of (siblings || [])) {
          try {
            await applyClassification(supabase, sib, owner_id, contact_ids, payload.classification);
            await supabase.from("email_ingest_queue").update({ status: "applied", applied_at: new Date().toISOString(), classification: { ...payload.classification, fuente_clasificacion: "hilo_manual" } }).eq("id", sib.id);
            threadApplied++;
          } catch (e: any) { console.error("[apply-thread]", e?.message); }
        }
      }

      return new Response(JSON.stringify({ ok: true, applied: 1, thread_applied: threadApplied }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Batch pending ────────────────────────────────
    const { data: items } = await supabase.from("email_ingest_queue").select("*").eq("status", "pending").order("received_at", { ascending: true }).limit(20);
    console.log(`[classify] batch=${items?.length || 0}`);

    let applied = 0, review = 0, discarded = 0, errored = 0;
    for (const item of (items || [])) {
      try {
        const { owner_id, contact_ids, classification } = await classifyItem(supabase, item, ctx);
        if (classification.es_relevante === false) {
          await supabase.from("email_ingest_queue").update({ status: "discarded", classification }).eq("id", item.id);
          discarded++; continue;
        }
        if (classification.confianza >= umbralAuto && classification.proyecto_id) {
          await applyClassification(supabase, item, owner_id, contact_ids, classification);
          await supabase.from("email_ingest_queue").update({ status: "applied", applied_at: new Date().toISOString(), classification }).eq("id", item.id);
          applied++;
        } else {
          // needs_review: si < umbralRev → sin propuesta (limpia)
          const isLow = classification.confianza < umbralRev;
          const finalClass = isLow
            ? { ...classification, proyecto_id: null, operador_id: null, categoria: "otro", fuente_clasificacion: "sin_clasificar", resumen: classification.resumen || item.subject || "" }
            : classification;
          const assignee = await resolveAssignee(supabase, item);
          await supabase.from("email_ingest_queue").update({
            status: "needs_review", classification: finalClass,
            assigned_to: assignee, assigned_at: assignee ? new Date().toISOString() : null,
          }).eq("id", item.id);
          if (assignee) await notifyAssignee(supabase, assignee, item);
          review++;
        }
      } catch (e: any) {
        console.error(`[classify] item ${item.id}:`, e?.message);
        await supabase.from("email_ingest_queue").update({ status: "error", error_msg: (e?.message || String(e)).slice(0, 500) }).eq("id", item.id);
        errored++;
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: items?.length || 0, applied, review, discarded, errored, umbralAuto, umbralRev }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[classify] fatal:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
