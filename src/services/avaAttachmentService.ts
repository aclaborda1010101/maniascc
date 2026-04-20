import { supabase } from "@/integrations/supabase/client";

export interface AvaAttachment {
  id: string;          // local UUID
  storage_path: string;
  file_name: string;
  mime_type: string;
  size: number;
  status: "uploading" | "processing" | "ready" | "error";
  extracted_text?: string;
  summary?: string;
  error?: string;
}

const BUCKET = "ava_attachments";

/**
 * Upload a file to ava_attachments and return the storage path.
 */
export async function uploadAvaAttachment(file: File, userId: string): Promise<{ path: string; error: string | null }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/octet-stream",
  });
  if (error) return { path: "", error: error.message };
  return { path, error: null };
}

/**
 * Trigger extraction via edge function.
 */
export async function processAvaAttachment(storagePath: string, mimeType: string, fileName: string) {
  const { data, error } = await supabase.functions.invoke("ava-attach-process", {
    body: { storage_path: storagePath, mime_type: mimeType, file_name: fileName },
  });
  if (error) return { success: false, error: error.message, extracted_text: "", summary: "" };
  if (data?.error) return { success: false, error: data.error, extracted_text: "", summary: "" };
  return {
    success: true,
    extracted_text: data?.extracted_text || "",
    summary: data?.summary || "",
  };
}

/**
 * Delete an attachment from storage (cleanup).
 */
export async function deleteAvaAttachment(storagePath: string) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
}
