import { supabase } from "@/integrations/supabase/client";

export interface RagStats {
  documents: { total: number; classified: number; indexed: number; unclassified: number; unindexed: number };
  chunks: { total: number; with_embedding: number; without_embedding: number };
  queue: Record<string, Record<string, number>>;
}

export async function fetchRagStats(): Promise<RagStats | null> {
  const { data, error } = await supabase.functions.invoke("rag-batch-orchestrator", {
    body: { mode: "stats" },
  });
  if (error || data?.error) return null;
  return data as RagStats;
}

export async function enqueueAllPending() {
  const { data, error } = await supabase.functions.invoke("rag-batch-orchestrator", {
    body: { mode: "enqueue_all" },
  });
  if (error) throw error;
  return data as { enqueued: number; breakdown: Record<string, number> };
}

export async function processBatch(taskType?: "classify" | "ingest" | "embed", batchSize = 5) {
  const { data, error } = await supabase.functions.invoke("rag-batch-orchestrator", {
    body: { mode: "process_batch", batch_size: batchSize, task_type: taskType },
  });
  if (error) throw error;
  return data as { processed: number; ok: number; ko: number; remaining: number };
}

/** Búsqueda RAG global (puede limitarse a un proyecto desde filters) */
export async function ragSearch(question: string, filters?: { proyecto_id?: string; dominio?: string }) {
  const { data, error } = await supabase.functions.invoke("rag-proxy", {
    body: { question, filters },
  });
  if (error) return { error: true, message: error.message };
  return data as {
    answer: string;
    citations: { documento_id?: string; nombre: string; chunk_index?: number }[] | string[];
    confidence: number;
    domain?: string;
    domains_found?: string[];
  };
}
