import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch pattern analysis data from the patterns edge function.
 * Returns layers, composite scores, and model verdict.
 */
export async function getPatterns() {
  try {
    const { data, error } = await supabase.functions.invoke("patterns-proxy");
    if (error) throw error;
    return data as { layers: unknown[]; composite_scores: unknown; model_verdict: string };
  } catch {
    return { error: true, message: "Análisis de patrones no disponible." };
  }
}
