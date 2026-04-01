import { supabase } from "@/integrations/supabase/client";

export interface ExpertForgeResponse {
  answer: string;
  sources?: Array<{ title: string; relevance: number }>;
  specialist_used?: string;
  confidence?: number;
  model?: string;
  latency_ms?: number;
  tokens?: { input: number; output: number };
  error?: string;
}

/**
 * Consulta al sistema Expert Forge MoE+RAG a través del edge function proxy.
 * @param question Pregunta en lenguaje natural
 * @param specialistId UUID del especialista MoE (opcional)
 * @param context Contexto adicional para la consulta (opcional)
 */
export async function queryExpertForge(
  question: string,
  specialistId?: string,
  context?: string,
): Promise<ExpertForgeResponse> {
  const { data, error } = await supabase.functions.invoke("expert-forge-proxy", {
    body: { question, specialist_id: specialistId, context },
  });

  if (error) {
    return { answer: "", error: error.message };
  }

  if (data?.error) {
    return { answer: "", error: data.error };
  }

  return {
    answer: data.answer || data.response || data.content || "",
    sources: data.sources || data.citations || [],
    specialist_used: data.specialist_used || data.specialist,
    confidence: data.confidence,
    model: data.model,
    latency_ms: data.latency_ms,
    tokens: data.tokens,
  };
}

/** IDs de especialistas preconfigurados */
export const EXPERT_SPECIALISTS = {
  NEGOCIACION: "442a4ad6",
  AUDITORIA: "6ace2754",
  MATCHING: "6a2cfd5e",
  ATLAS: "442a4ad6",
  FORGE7: "0de742b5",
  SCRAPING: "24d75154",
  COORDINADOR: "59d5e344",
} as const;
