import { supabase } from "@/integrations/supabase/client";

/**
 * Query the RAG knowledge base via edge function.
 * Returns an AI-generated answer with citations.
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
  return data as { answer: string; citations: string[]; confidence: number };
}

/**
 * Ingest a document into the RAG knowledge base (chunking + indexing).
 */
export async function ingestDocument(documentoId: string) {
  const { data, error } = await supabase.functions.invoke("rag-ingest", {
    body: { documento_id: documentoId },
  });
  if (error) {
    return { success: false, error: error.message };
  }
  if (data?.error) {
    return { success: false, error: data.error };
  }
  return data as { success: boolean; chunks_created: number; documento_id: string };
}
