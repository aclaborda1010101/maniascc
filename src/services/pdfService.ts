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

// ─────────────────────────────────────────────────────────────────────────────
// CHAT EXPORT — single message + full conversation
// ─────────────────────────────────────────────────────────────────────────────

interface ChatSources {
  documents?: Array<{ name: string; domain?: string; snippet?: string }>;
  entities?: Array<{ table: string; name: string; subtitle?: string }>;
  external?: Array<{ source: string; label: string; detail?: string; url?: string }>;
}

interface ExportableMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
  sources?: ChatSources;
}

function formatSourcesMarkdown(s?: ChatSources): string {
  if (!s) return "";
  const parts: string[] = [];
  if (s.documents && s.documents.length > 0) {
    parts.push(`**📄 Documentos consultados (${s.documents.length})**\n` +
      s.documents.map(d => `- **${d.name}**${d.domain ? ` _(${d.domain})_` : ""}${d.snippet ? `\n  > ${d.snippet.replace(/\n/g, " ")}` : ""}`).join("\n"));
  }
  if (s.entities && s.entities.length > 0) {
    parts.push(`**🗂️ Registros consultados (${s.entities.length})**\n` +
      s.entities.map(e => `- _${e.table}_ — **${e.name}**${e.subtitle ? ` · ${e.subtitle}` : ""}`).join("\n"));
  }
  if (s.external && s.external.length > 0) {
    parts.push(`**🌐 Fuentes externas (${s.external.length})**\n` +
      s.external.map(x => `- **${x.label}** _(${x.source})_${x.detail ? ` — ${x.detail}` : ""}${x.url ? ` — ${x.url}` : ""}`).join("\n"));
  }
  if (parts.length === 0) return "";
  return `\n\n---\n\n### Fuentes\n\n${parts.join("\n\n")}`;
}

function fmtDate(ts?: number): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" });
  } catch { return ""; }
}

/**
 * Export a single AVA response as a polished PDF (uses generic AVA template).
 */
export async function exportAvaMessageToPdf(
  message: ExportableMessage,
  opts?: { title?: string; userQuestion?: string }
): Promise<{ blob: Blob | null; error: string | null }> {
  const title = opts?.title || "Respuesta AVA";
  const md =
    (opts?.userQuestion ? `> **Pregunta:** ${opts.userQuestion.replace(/\n/g, " ")}\n\n---\n\n` : "") +
    message.content +
    formatSourcesMarkdown(message.sources);
  return generateProfessionalPdf(title, md, "Respuesta AVA");
}

/**
 * Export an entire conversation as a structured Q&A PDF with sources per assistant message.
 */
export async function exportAvaConversationToPdf(
  conversationTitle: string,
  messages: ExportableMessage[]
): Promise<{ blob: Blob | null; error: string | null }> {
  if (!messages || messages.length === 0) {
    return { blob: null, error: "Conversación vacía" };
  }
  const sections: string[] = [];
  let turn = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      turn += 1;
      sections.push(`## Turno ${turn} · Pregunta del usuario\n\n${fmtDate(m.timestamp) ? `_${fmtDate(m.timestamp)}_\n\n` : ""}${m.content}`);
    } else {
      sections.push(`## Respuesta de AVA${turn ? ` — turno ${turn}` : ""}\n\n${fmtDate(m.timestamp) ? `_${fmtDate(m.timestamp)}_\n\n` : ""}${m.content}${formatSourcesMarkdown(m.sources)}`);
    }
  }
  const md = sections.join("\n\n---\n\n");
  return generateProfessionalPdf(conversationTitle || "Conversación AVA", md, "Conversación AVA");
}
