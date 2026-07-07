// rag-backfill-links: reclasificación del archivo histórico
// Vincula documentos huérfanos a contactos/proyectos/operadores por fases,
// y propaga proyecto_id a document_chunks. Reversible por fase (metadata_extraida.linked_by).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const STOPWORDS = new Set([
  "proyecto","proyectos","centro","centros","comercial","comerciales","motor",
  "partners","partner","group","grupo","spain","espana","españa","the","and",
  "para","desde","sobre","local","locales","activo","activos","edificio",
  "oficina","oficinas","tienda","tiendas","plaza","calle","avenida","nave",
  "polígono","poligono","parque",
]);

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s).split(" ").filter((t) => t.length >= 5 && !STOPWORDS.has(t));
}

function extractEmails(txt: string): string[] {
  if (!txt) return [];
  const angle = [...txt.matchAll(/<([^<>@\s]+@[^<>@\s]+)>/g)].map((m) => m[1]);
  const bare = [...txt.matchAll(/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/g)].map((m) => m[1]);
  const all = angle.length ? angle : bare;
  return [...new Set(all.map((e) => e.toLowerCase()))];
}

async function checkAuth(req: Request): Promise<boolean> {
  const auth = req.headers.get("Authorization") || "";
  if (auth === `Bearer ${SERVICE_ROLE}`) return true;
  const tok = auth.replace(/^Bearer\s+/i, "");
  if (!tok) return false;
  const anon = createClient(SUPABASE_URL, ANON);
  const { data, error } = await anon.auth.getClaims(tok);
  if (error || !data?.claims?.sub) return false;
  const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", data.claims.sub);
  return (roles || []).some((r: any) => r.role === "admin");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!await checkAuth(req)) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body = await req.json().catch(() => ({}));
    const phase: string = body.phase || "status";
    const dryRun: boolean = !!body.dry_run;
    const batchSize: number = Math.min(Math.max(Number(body.batch_size) || 1000, 100), 2000);
    const svc = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (phase === "status") return json(await getStatus(svc));
    if (phase === "contactos_from") return json(await phaseContactosFromTo(svc, "from", batchSize, dryRun));
    if (phase === "contactos_to") return json(await phaseContactosFromTo(svc, "to", batchSize, dryRun));
    if (phase === "hilos") return json(await phaseHilos(svc, batchSize, dryRun));
    if (phase === "proyectos_tokens") return json(await phaseProyectos(svc, batchSize, dryRun));
    if (phase === "chunks") return json(await phaseChunks(svc, batchSize, dryRun));

    return new Response(JSON.stringify({ error: "unknown phase" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

function json(payload: any) {
  return new Response(JSON.stringify(payload), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function getStatus(svc: any) {
  const cnt = async (q: any) => {
    const { count } = await q;
    return count || 0;
  };
  const total = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }));
  const conContacto = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).not("contacto_id", "is", null));
  const conProyecto = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).not("proyecto_id", "is", null));
  const conOperador = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).not("operador_id", "is", null));
  const pendientesContacto = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).is("contacto_id", null));
  const pendientesProyecto = await cnt(svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).is("proyecto_id", null));
  const chunksTotal = await cnt(svc.from("document_chunks").select("id", { count: "exact", head: true }));
  const chunksConProy = await cnt(svc.from("document_chunks").select("id", { count: "exact", head: true }).not("proyecto_id", "is", null));

  // Duplicados de proyectos por nombre
  const { data: proys } = await svc.from("proyectos").select("id,nombre,created_at").order("created_at", { ascending: true });
  const dupMap = new Map<string, string[]>();
  (proys || []).forEach((p: any) => {
    const k = normalize(p.nombre || "");
    if (!k) return;
    const arr = dupMap.get(k) || [];
    arr.push(p.nombre);
    dupMap.set(k, arr);
  });
  const duplicados = [...dupMap.entries()].filter(([_, v]) => v.length > 1).map(([k, v]) => ({ nombre_norm: k, ocurrencias: v.length }));

  return {
    documentos: { total, con_contacto: conContacto, con_proyecto: conProyecto, con_operador: conOperador, pendientes_contacto: pendientesContacto, pendientes_proyecto: pendientesProyecto },
    chunks: { total: chunksTotal, con_proyecto: chunksConProy, pendientes: chunksTotal - chunksConProy },
    proyectos_duplicados: duplicados,
  };
}

async function phaseContactosFromTo(svc: any, dir: "from" | "to", batch: number, dry: boolean) {
  // Cargar mapa de emails → contacto (más antiguo). Caché por invocación.
  const emailMap = await loadEmailContactMap(svc);

  const { data: docs, error } = await svc
    .from("documentos_proyecto")
    .select("id, metadata_extraida")
    .is("contacto_id", null)
    .limit(batch);
  if (error) throw error;

  let linked = 0;
  const updates: { id: string; contacto_id: string }[] = [];
  for (const d of docs || []) {
    const md = d.metadata_extraida || {};
    const raw = String(md[dir] || "");
    if (!raw) continue;
    const emails = extractEmails(raw);
    for (const e of emails) {
      const cid = emailMap.get(e);
      if (cid) { updates.push({ id: d.id, contacto_id: cid }); linked++; break; }
    }
  }

  if (!dry && updates.length) {
    const linkedBy = dir === "from" ? "contactos_from" : "contactos_to";
    // aplicar en lote pequeño
    for (const u of updates) {
      await svc.from("documentos_proyecto")
        .update({
          contacto_id: u.contacto_id,
          metadata_extraida: mergeLinkedBy(await getMd(svc, u.id), linkedBy),
        })
        .eq("id", u.id);
    }
  }

  const processed = (docs || []).length;
  const remainingRow = await svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).is("contacto_id", null);
  const remaining = remainingRow.count || 0;
  const done = processed < batch;
  return { phase: dir === "from" ? "contactos_from" : "contactos_to", processed, linked, remaining, done, dry_run: dry };
}

// Cache metadata_extraida — necesario para hacer merge sin perder claves
async function getMd(svc: any, id: string): Promise<any> {
  const { data } = await svc.from("documentos_proyecto").select("metadata_extraida").eq("id", id).maybeSingle();
  return data?.metadata_extraida || {};
}
function mergeLinkedBy(md: any, phase: string) {
  const cur = Array.isArray(md?.linked_by) ? md.linked_by : (md?.linked_by ? [md.linked_by] : []);
  if (!cur.includes(phase)) cur.push(phase);
  return { ...(md || {}), linked_by: cur };
}

async function loadEmailContactMap(svc: any): Promise<Map<string, string>> {
  // DISTINCT ON email por más antiguo — cargar todos, deduplicar en JS.
  const map = new Map<string, { id: string; created_at: string }>();
  let from = 0; const step = 1000;
  while (true) {
    const { data, error } = await svc.from("contactos")
      .select("id,email,created_at")
      .not("email", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + step - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const c of data) {
      const e = String(c.email || "").trim().toLowerCase();
      if (!e) continue;
      if (!map.has(e)) map.set(e, { id: c.id, created_at: c.created_at });
    }
    if (data.length < step) break;
    from += step;
  }
  const out = new Map<string, string>();
  map.forEach((v, k) => out.set(k, v.id));
  return out;
}

async function phaseHilos(svc: any, batch: number, dry: boolean) {
  const { data: docs, error } = await svc
    .from("documentos_proyecto")
    .select("id, metadata_extraida")
    .is("contacto_id", null)
    .limit(batch);
  if (error) throw error;

  const threadIds = [...new Set((docs || [])
    .map((d: any) => d.metadata_extraida?.thread_id)
    .filter(Boolean))];
  if (!threadIds.length) {
    return { phase: "hilos", processed: (docs || []).length, linked: 0, remaining: 0, done: true, dry_run: dry };
  }

  // buscar en lotes de 200 thread_ids
  const threadMap = new Map<string, { contacto_id: string; proyecto_id?: string; operador_id?: string }>();
  const chunk = 200;
  for (let i = 0; i < threadIds.length; i += chunk) {
    const slice = threadIds.slice(i, i + chunk);
    const { data: refs } = await svc
      .from("documentos_proyecto")
      .select("contacto_id,proyecto_id,operador_id,metadata_extraida")
      .not("contacto_id", "is", null)
      .in("metadata_extraida->>thread_id", slice as any);
    for (const r of refs || []) {
      const t = r.metadata_extraida?.thread_id;
      if (t && !threadMap.has(t)) {
        threadMap.set(t, { contacto_id: r.contacto_id, proyecto_id: r.proyecto_id || undefined, operador_id: r.operador_id || undefined });
      }
    }
  }

  let linked = 0;
  for (const d of docs || []) {
    const t = d.metadata_extraida?.thread_id;
    if (!t) continue;
    const ref = threadMap.get(t);
    if (!ref) continue;
    if (!dry) {
      const upd: any = { contacto_id: ref.contacto_id, metadata_extraida: mergeLinkedBy(d.metadata_extraida, "hilos") };
      if (ref.proyecto_id) upd.proyecto_id = ref.proyecto_id;
      if (ref.operador_id) upd.operador_id = ref.operador_id;
      await svc.from("documentos_proyecto").update(upd).eq("id", d.id);
    }
    linked++;
  }

  const processed = (docs || []).length;
  const remainingRow = await svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).is("contacto_id", null);
  const remaining = remainingRow.count || 0;
  const done = linked === 0; // si no vinculó nada en un batch entero, no habrá más
  return { phase: "hilos", processed, linked, remaining, done, dry_run: dry };
}

async function phaseProyectos(svc: any, batch: number, dry: boolean) {
  // Cargar proyectos activos (más antiguo por nombre normalizado)
  const { data: proys } = await svc
    .from("proyectos")
    .select("id,nombre,estado,created_at")
    .in("estado", ["activo", "en_negociacion"])
    .order("created_at", { ascending: true });

  const byNorm = new Map<string, { id: string; nombre: string }>();
  for (const p of proys || []) {
    const k = normalize(p.nombre || "");
    if (k && !byNorm.has(k)) byNorm.set(k, { id: p.id, nombre: p.nombre });
  }

  // tokens únicos: token -> proyecto_id (si aparece en >1 proyecto → null)
  const tokenMap = new Map<string, string | null>();
  for (const p of byNorm.values()) {
    const toks = new Set(tokenize(p.nombre));
    for (const t of toks) {
      if (tokenMap.has(t)) {
        if (tokenMap.get(t) !== p.id) tokenMap.set(t, null);
      } else {
        tokenMap.set(t, p.id);
      }
    }
  }
  const uniqueTokens = new Map<string, string>();
  tokenMap.forEach((v, k) => { if (v) uniqueTokens.set(k, v); });

  if (uniqueTokens.size === 0) {
    return { phase: "proyectos_tokens", processed: 0, linked: 0, remaining: 0, done: true, dry_run: dry, unique_tokens: 0 };
  }

  const { data: docs, error } = await svc
    .from("documentos_proyecto")
    .select("id,nombre,metadata_extraida")
    .is("proyecto_id", null)
    .limit(batch);
  if (error) throw error;

  let linked = 0;
  for (const d of docs || []) {
    const hay = normalize(`${d.nombre || ""} ${d.metadata_extraida?.email_subject || ""}`);
    if (!hay) continue;
    const matched = new Set<string>();
    for (const [tok, pid] of uniqueTokens) {
      if (hay.includes(tok)) matched.add(pid);
      if (matched.size > 1) break;
    }
    if (matched.size === 1) {
      const pid = [...matched][0];
      if (!dry) {
        await svc.from("documentos_proyecto")
          .update({ proyecto_id: pid, metadata_extraida: mergeLinkedBy(d.metadata_extraida, "proyectos_tokens") })
          .eq("id", d.id);
      }
      linked++;
    }
  }

  const processed = (docs || []).length;
  const remainingRow = await svc.from("documentos_proyecto").select("id", { count: "exact", head: true }).is("proyecto_id", null);
  const remaining = remainingRow.count || 0;
  const done = processed < batch;
  return { phase: "proyectos_tokens", processed, linked, remaining, done, dry_run: dry, unique_tokens: uniqueTokens.size };
}

async function phaseChunks(svc: any, batch: number, dry: boolean) {
  // Buscar documento_ids que tengan proyecto_id pero cuyos chunks no lo tengan
  const { data: docs, error } = await svc
    .from("documentos_proyecto")
    .select("id,proyecto_id")
    .not("proyecto_id", "is", null)
    .limit(batch);
  if (error) throw error;
  if (!docs || docs.length === 0) return { phase: "chunks", processed: 0, linked: 0, remaining: 0, done: true, dry_run: dry };

  let linked = 0;
  for (const d of docs) {
    // Contar chunks huérfanos primero (barato con head:true)
    const { count } = await svc.from("document_chunks")
      .select("id", { count: "exact", head: true })
      .eq("documento_id", d.id)
      .is("proyecto_id", null);
    if (!count) continue;
    if (!dry) {
      await svc.from("document_chunks").update({ proyecto_id: d.proyecto_id }).eq("documento_id", d.id).is("proyecto_id", null);
    }
    linked += count;
  }

  const remainingRow = await svc.from("document_chunks").select("id", { count: "exact", head: true }).is("proyecto_id", null);
  const remaining = remainingRow.count || 0;
  const done = linked === 0;
  return { phase: "chunks", processed: docs.length, linked, remaining, done, dry_run: dry };
}
