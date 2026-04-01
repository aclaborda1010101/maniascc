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
 * Health check del gateway Expert Forge (no requiere question ni router_id).
 */
export async function healthCheckExpertForge(): Promise<{
  status: "ok" | "error";
  latency_ms: number;
  error?: string;
}> {
  const start = Date.now();
  const { data, error } = await supabase.functions.invoke("expert-forge-proxy", {
    body: { action: "health_check" },
  });
  const latency = Date.now() - start;
  if (error) return { status: "error", latency_ms: latency, error: error.message };
  if (data?.status === "error") return { status: "error", latency_ms: data.latency_ms || latency, error: data.error };
  return { status: "ok", latency_ms: data?.latency_ms || latency };
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
  ATLAS: "442a4ad6-c740-49d1-bd96-42a37a6b09ec",
  FORGE7: "0de742b5-1048-455a-8fbd-a710fa300b45",
  MATCHING: "6a2cfd5e-e81a-4486-bb96-1d52e7bd0dd0",
  AUDITORIA: "6ace2754-f6e2-4e95-bd58-f476096cd74b",
  SCRAPING: "24d75154-48fd-4203-8d82-8ba8ad2a1540",
  COORDINADOR: "59d5e344-f6f8-42b8-93ba-c8c7dbe204b5",
  NEGOCIACION: "442a4ad6-c740-49d1-bd96-42a37a6b09ec",
} as const;
