import { supabase } from "@/integrations/supabase/client";

export async function generateProfessionalPdf(
  title: string,
  markdownContent: string,
  modeLabel?: string
): Promise<{ blob: Blob | null; error: string | null }> {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || anonKey;

    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/generate-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "apikey": anonKey,
        },
        body: JSON.stringify({
          title,
          content_markdown: markdownContent,
          mode_label: modeLabel || "Informe",
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Error desconocido" }));
      return { blob: null, error: err.error || `Error ${response.status}` };
    }

    const blob = await response.blob();
    return { blob, error: null };
  } catch (err: any) {
    return { blob: null, error: err.message || "Error generando PDF" };
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
