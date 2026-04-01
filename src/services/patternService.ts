import { supabase } from "@/integrations/supabase/client";

export interface Signal {
  name: string;
  layer: number;
  value: any;
  credibility_class: string;
  trend?: string;
  source?: string;
}

export interface PatternResponse {
  signals?: Signal[];
  success_signals?: Signal[];
  risk_signals?: Signal[];
  reference_benchmarks?: any;
  composite_scores?: any;
  model_verdict?: string;
  confidence_cap?: number;
  hypotheses?: any[];
  success_blueprint?: any;
  latency_ms?: number;
  error?: string;
}

export interface PatternRun {
  run_id: string;
  sector: string;
  geography: string;
  status: string;
  model_verdict: string;
  completed_at: string;
  signals_count: number;
}

export async function queryPatterns(
  queryType: string,
  filters: Record<string, any> = {},
): Promise<PatternResponse> {
  try {
    const { data, error } = await supabase.functions.invoke("pattern-proxy", {
      body: { action: "public_query_v2", query_type: queryType, filters },
    });
    if (error) return { error: error.message };
    if (data?.error) return { error: data.error };
    return data as PatternResponse;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

export async function sendPatternFeedback(
  feedbackType: string,
  data: Record<string, any>,
): Promise<void> {
  try {
    await supabase.functions.invoke("pattern-proxy", {
      body: { action: "feedback_ingest", feedback_type: feedbackType, data },
    });
  } catch (e) {
    console.error("Pattern feedback error:", e);
  }
}

export async function getAvailableRuns(): Promise<PatternRun[]> {
  try {
    const { data, error } = await supabase.functions.invoke("pattern-proxy", {
      body: { action: "list_available_runs" },
    });
    if (error || data?.error) return [];
    return (data?.runs || data || []) as PatternRun[];
  } catch {
    return [];
  }
}
