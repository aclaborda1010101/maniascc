import { supabase } from "@/integrations/supabase/client";

/**
 * Query the RAG knowledge base via edge function.
 */
export async function queryRAG(question: string, filters?: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("rag-proxy", {
    body: { question, filters },
  });
  if (error) {
    return { answer: "", citations: [] as string[], confidence: 0, error: true, message: error.message };
  }
  if (data?.error) {
    return { answer: "", citations: [] as string[], confidence: 0, error: true, message: data.error };
  }
  return data as { answer: string; citations: string[]; confidence: number; domain?: string; domains_found?: string[] };
}

/**
 * Ingest a document into the RAG knowledge base (chunking + indexing).
 */
export async function ingestDocument(documentoId: string, dominio?: string): Promise<{ success: boolean; chunks_created: number; dominio?: string; error?: string }> {
  const { data, error } = await supabase.functions.invoke("rag-ingest", {
    body: { documento_id: documentoId, dominio },
  });
  if (error) return { success: false, chunks_created: 0, error: error.message };
  if (data?.error) return { success: false, chunks_created: 0, error: data.error };
  return { success: true, chunks_created: data?.chunks_created || 0, dominio: data?.dominio };
}

export type ForgeMode =
  | "dossier_operador"
  | "presentacion_comercial"
  | "borrador_contrato"
  | "plan_estrategico"
  | "informe_war_room"
  | "email_comunicacion";

export const FORGE_MODES: { value: ForgeMode; label: string; icon: string; description: string }[] = [
  { value: "dossier_operador", label: "Dossier de Operador", icon: "📋", description: "Perfil completo con histórico, palancas y recomendaciones" },
  { value: "presentacion_comercial", label: "Presentación Comercial", icon: "📊", description: "Teaser premium con tenant mix y proyecciones" },
  { value: "borrador_contrato", label: "Borrador de Contrato", icon: "📝", description: "Borrador jurídico con cláusulas estructuradas" },
  { value: "plan_estrategico", label: "Plan Estratégico", icon: "🎯", description: "Plan McKinsey con DAFO, roadmap y financiero" },
  { value: "informe_war_room", label: "Informe War Room", icon: "⚡", description: "Dashboard ejecutivo con semáforos y alertas" },
  { value: "email_comunicacion", label: "Email / Comunicación", icon: "✉️", description: "Email profesional con preview HTML" },
];

export interface StructuredForgeOutput {
  content: string;
  structured: any;
  mode: ForgeMode;
  model: string;
  latency_ms: number;
  tokens: { input: number; output: number };
  error?: string;
}

/**
 * Generate a document using FORGE agent — structured JSON output by default.
 */
export type EmailVariant = "teaser" | "negociacion" | "cierre";

export async function generateForgeDocument(
  mode: ForgeMode,
  context: string,
  proyectoId?: string,
  format: "structured" | "markdown" = "structured",
  emailVariant?: EmailVariant
): Promise<StructuredForgeOutput> {
  const { data, error } = await supabase.functions.invoke("ai-forge", {
    body: { mode, context, proyecto_id: proyectoId, format, email_variant: emailVariant },
  });
  if (error) {
    return { content: "", structured: null, mode, model: "", latency_ms: 0, tokens: { input: 0, output: 0 }, error: error.message };
  }
  if (data?.error) {
    return { content: "", structured: null, mode, model: "", latency_ms: 0, tokens: { input: 0, output: 0 }, error: data.error };
  }
  return data;
}
