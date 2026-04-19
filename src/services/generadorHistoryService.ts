import { supabase } from "@/integrations/supabase/client";
import type { ForgeMode } from "@/services/ragService";
import { generateForgeDocumentPdf } from "@/services/pdfService";

export interface DocumentoGenerado {
  id: string;
  owner_id: string;
  visibility: string;
  mode: string;
  mode_label: string;
  titulo: string | null;
  contexto: string | null;
  structured_data: any;
  proyecto_id: string | null;
  storage_path: string | null;
  modelo: string | null;
  latencia_ms: number | null;
  documento_proyecto_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Deriva un título del structured (fallback al modeLabel + fecha). */
function inferTitle(structured: any, modeLabel: string): string {
  if (!structured) return `${modeLabel} · ${new Date().toLocaleDateString("es-ES")}`;
  return (
    structured.titulo ||
    structured.title ||
    structured.nombre ||
    structured.subject ||
    structured.header?.titulo ||
    `${modeLabel} · ${new Date().toLocaleDateString("es-ES")}`
  );
}

function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 120);
}

/**
 * Guarda un documento generado: PDF al bucket privado + metadatos en BD.
 * No bloquea la UI si algo falla, solo devuelve el error.
 */
export async function saveGeneratedDocument(params: {
  mode: ForgeMode;
  modeLabel: string;
  contexto: string;
  structured: any;
  proyectoId?: string | null;
  modelo?: string | null;
  latencyMs?: number | null;
}): Promise<{ doc: DocumentoGenerado | null; error: string | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) return { doc: null, error: "Usuario no autenticado" };

    const titulo = inferTitle(params.structured, params.modeLabel);

    // 1. Generar el PDF
    const { blob, error: pdfError } = await generateForgeDocumentPdf(
      params.mode,
      params.structured,
      params.modeLabel,
    );

    let storagePath: string | null = null;
    if (blob && !pdfError) {
      const filename = `${Date.now()}_${safeFilename(titulo)}.pdf`;
      const path = `${userId}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from("documentos_generados")
        .upload(path, blob, { contentType: "application/pdf", upsert: false });
      if (!uploadError) storagePath = path;
    }

    // 2. Guardar registro
    const { data, error } = await supabase
      .from("documentos_generados")
      .insert({
        owner_id: userId,
        visibility: "private",
        mode: params.mode,
        mode_label: params.modeLabel,
        titulo,
        contexto: params.contexto,
        structured_data: params.structured,
        proyecto_id: params.proyectoId || null,
        storage_path: storagePath,
        modelo: params.modelo || null,
        latencia_ms: params.latencyMs || null,
      })
      .select()
      .single();

    if (error) return { doc: null, error: error.message };

    // 3. Espejo en documentos_proyecto para que aparezca en /documentos
    if (storagePath) {
      await supabase.from("documentos_proyecto").insert({
        nombre: `${titulo}.pdf`,
        nombre_normalizado: safeFilename(titulo),
        tipo_documento: "generado",
        storage_path: storagePath,
        mime_type: "application/pdf",
        proyecto_id: params.proyectoId || null,
        owner_id: userId,
        visibility: "private",
        origen: "generador",
        origen_external_id: data.id,
        procesado_ia: true,
        resumen_ia: params.contexto?.slice(0, 500) || null,
        fase_rag: "skipped",
      });
    }

    return { doc: data as DocumentoGenerado, error: null };
  } catch (err: any) {
    return { doc: null, error: err.message || "Error guardando documento" };
  }
}

export async function listGeneratedDocuments(): Promise<DocumentoGenerado[]> {
  const { data, error } = await supabase
    .from("documentos_generados")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("listGeneratedDocuments", error);
    return [];
  }
  return (data || []) as DocumentoGenerado[];
}

export async function downloadGeneratedDocument(doc: DocumentoGenerado): Promise<{ blob: Blob | null; error: string | null }> {
  if (!doc.storage_path) return { blob: null, error: "Este documento no tiene PDF guardado" };
  const { data, error } = await supabase.storage
    .from("documentos_generados")
    .download(doc.storage_path);
  if (error) return { blob: null, error: error.message };
  return { blob: data, error: null };
}

export async function deleteGeneratedDocument(doc: DocumentoGenerado): Promise<{ error: string | null }> {
  if (doc.storage_path) {
    await supabase.storage.from("documentos_generados").remove([doc.storage_path]);
  }
  // Borrar espejo
  await supabase
    .from("documentos_proyecto")
    .delete()
    .eq("origen", "generador")
    .eq("origen_external_id", doc.id);
  const { error } = await supabase.from("documentos_generados").delete().eq("id", doc.id);
  return { error: error?.message || null };
}
