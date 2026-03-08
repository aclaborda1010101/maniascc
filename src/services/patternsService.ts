import { supabase } from "@/integrations/supabase/client";

export async function getPatterns() {
  try {
    const { data, error } = await supabase.functions.invoke("patterns-proxy");
    if (error) throw error;
    return data as { layers: any[]; composite_scores: any; model_verdict: string };
  } catch {
    return { error: true, message: "Análisis de patrones no disponible." };
  }
}
