import { supabase } from "@/integrations/supabase/client";

export type Sensibilidad = "publico" | "interno" | "confidencial" | "restringido";
export type EntityType = "activo" | "operador" | "proyecto" | "contacto" | "negociacion" | "subdivision";

export interface Taxonomia {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  icono: string | null;
  color: string | null;
  orden: number;
}

export interface DocumentoExt {
  id: string;
  nombre: string;
  nombre_normalizado: string | null;
  mime_type: string | null;
  tamano_bytes: number | null;
  storage_path: string;
  owner_id: string | null;
  visibility: string;
  nivel_sensibilidad: Sensibilidad;
  taxonomia_id: string | null;
  taxonomia?: Taxonomia | null;
  hash_md5: string | null;
  origen: string;
  fase_rag: string;
  fecha_documento: string | null;
  resumen_ia: string | null;
  procesado_ia: boolean | null;
  created_at: string | null;
}

export async function fetchTaxonomias(): Promise<Taxonomia[]> {
  const { data } = await supabase
    .from("documentos_taxonomia")
    .select("*")
    .eq("activo", true)
    .order("orden");
  return (data as Taxonomia[]) || [];
}

export interface FetchDocumentosResult {
  rows: DocumentoExt[];
  total: number;
}

export async function fetchDocumentos(
  filters: { taxonomia?: string; origen?: string; search?: string } = {},
  range: { from?: number; to?: number } = {},
): Promise<FetchDocumentosResult> {
  const from = range.from ?? 0;
  const to = range.to ?? from + 99; // default 100 por página
  let q = supabase
    .from("documentos_proyecto")
    .select("*, taxonomia:taxonomia_id(id,codigo,nombre,icono,color)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (filters.taxonomia) q = q.eq("taxonomia_id", filters.taxonomia);
  if (filters.origen) q = q.eq("origen", filters.origen);
  if (filters.search) q = q.ilike("nombre", `%${filters.search}%`);
  const { data, count } = await q;
  return {
    rows: (data as unknown as DocumentoExt[]) || [],
    total: count ?? 0,
  };
}

export async function classifyDocument(documentoId: string, sample?: string) {
  const { data, error } = await supabase.functions.invoke("document-classify", {
    body: { documento_id: documentoId, contenido_muestra: sample },
  });
  if (error) throw error;
  return data;
}

export async function linkDocument(documentoId: string, entityType: EntityType, entityId: string, rol?: string) {
  return supabase.from("document_links").insert({
    documento_id: documentoId, entity_type: entityType, entity_id: entityId, rol,
  } as never);
}

export async function unlinkDocument(linkId: string) {
  return supabase.from("document_links").delete().eq("id", linkId);
}

export async function fetchDocumentLinks(documentoId: string) {
  const { data } = await supabase.from("document_links")
    .select("*")
    .eq("documento_id", documentoId);
  return data || [];
}

export async function startOneDriveSync(userId: string, mode: "backfill" | "delta") {
  const { data, error } = await supabase.functions.invoke("onedrive-sync", {
    body: { user_id: userId, mode, max_items: 200 },
  });
  if (error) throw error;
  return data;
}

export async function fetchOneDriveState(userId: string) {
  const { data } = await supabase.from("onedrive_sync_state")
    .select("*").eq("user_id", userId).maybeSingle();
  return data;
}

export async function fetchIngestionJobs(userId: string, limit = 10) {
  const { data } = await supabase.from("ingestion_jobs")
    .select("*").eq("user_id", userId)
    .order("created_at", { ascending: false }).limit(limit);
  return data || [];
}
