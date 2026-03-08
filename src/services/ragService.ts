import { supabase } from "@/integrations/supabase/client";

export async function queryRAG(question: string, filters?: object) {
  try {
    const { data, error } = await supabase.functions.invoke("rag-proxy", {
      body: { question, filters },
    });
    if (error) throw error;
    return data as { answer: string; citations: string[]; confidence: number };
  } catch {
    return { error: true, message: "Base de conocimiento no disponible." };
  }
}
