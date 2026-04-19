import { supabase } from "@/integrations/supabase/client";
import type { ForgeMode } from "@/services/ragService";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || ANON_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    apikey: ANON_KEY,
  };
}

/**
 * Generic markdown→PDF (legacy, used by AVA reports).
 */
export async function generateProfessionalPdf(
  title: string,
  markdownContent: string,
  modeLabel?: string
): Promise<{ blob: Blob | null; error: string | null }> {
  try {
    const headers = await authHeaders();
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/generate-pdf`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, content_markdown: markdownContent, mode_label: modeLabel || "Informe" }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Error desconocido" }));
      return { blob: null, error: err.error || `Error ${response.status}` };
    }
    return { blob: await response.blob(), error: null };
  } catch (err: any) {
    return { blob: null, error: err.message || "Error generando PDF" };
  }
}

/**
 * NEW: Render structured FORGE output → professional PDF v2.
 */
export async function generateForgeDocumentPdf(
  mode: ForgeMode,
  data: any,
  modeLabel: string,
  heroImage?: string
): Promise<{ blob: Blob | null; error: string | null }> {
  try {
    const headers = await authHeaders();
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/generate-pdf-v2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode, data, mode_label: modeLabel, hero_image: heroImage, output: "pdf" }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Error desconocido" }));
      return { blob: null, error: err.error || `Error ${response.status}` };
    }
    return { blob: await response.blob(), error: null };
  } catch (err: any) {
    return { blob: null, error: err.message || "Error generando PDF" };
  }
}

/**
 * NEW: Render structured FORGE output → HTML preview (for iframe).
 */
export async function getForgeDocumentHtml(
  mode: ForgeMode,
  data: any,
  modeLabel: string,
  heroImage?: string
): Promise<{ html: string | null; error: string | null }> {
  try {
    const headers = await authHeaders();
    const response = await fetch(`https://${PROJECT_ID}.supabase.co/functions/v1/generate-pdf-v2`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode, data, mode_label: modeLabel, hero_image: heroImage, output: "html" }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Error desconocido" }));
      return { html: null, error: err.error || `Error ${response.status}` };
    }
    return { html: await response.text(), error: null };
  } catch (err: any) {
    return { html: null, error: err.message || "Error generando preview" };
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
