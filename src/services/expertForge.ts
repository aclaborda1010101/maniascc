// Expert Forge MoE externo: RETIRADO.
// Mantenemos stubs vacíos para evitar errores transitorios de import durante el build.
// Toda la inteligencia se sirve ahora desde el RAG interno (rag-proxy + document_chunks)
// y el orquestador AVA con Lovable AI Gateway.

export const EXPERT_SPECIALISTS = {} as Record<string, string>;

export interface ExpertForgeResponse {
  answer: string;
  error?: string;
}

export async function queryExpertForge(): Promise<ExpertForgeResponse> {
  return { answer: "", error: "Expert Forge retirado. Usa el asistente AVA." };
}

export async function healthCheckExpertForge() {
  return { status: "error" as const, latency_ms: 0, error: "Expert Forge retirado" };
}
