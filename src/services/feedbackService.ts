import { supabase } from "@/integrations/supabase/client";

export type FeedbackType = 'thumbs_up' | 'thumbs_down' | 'star_rating' | 'correction';
export type FeedbackAction = 'viewed' | 'clicked' | 'approved' | 'rejected' | 'exported' | 'copied' | 'ignored' | 'selected';
export type EntityType = 'match' | 'rag_response' | 'forge_document' | 'suggestion' | 'insight';

interface ExplicitFeedback {
  entidadTipo: EntityType;
  entidadId: string;
  rating?: number;
  feedbackTipo?: FeedbackType;
  comentario?: string;
  correccionSugerida?: string;
  contexto?: Record<string, unknown>;
}

interface ImplicitFeedback {
  entidadTipo: EntityType;
  entidadId: string;
  accion: FeedbackAction;
  tiempoVisualizacionMs?: number;
  posicionEnLista?: number;
  seleccionado?: boolean;
  contexto?: Record<string, unknown>;
}

/**
 * Record explicit user feedback (ratings, thumbs up/down, corrections)
 */
export async function recordExplicitFeedback(feedback: ExplicitFeedback): Promise<{ success: boolean; error?: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase.from('ai_feedback' as any).insert({
    entidad_tipo: feedback.entidadTipo,
    entidad_id: feedback.entidadId,
    usuario_id: user.id,
    rating: feedback.rating,
    feedback_tipo: feedback.feedbackTipo,
    comentario: feedback.comentario,
    correccion_sugerida: feedback.correccionSugerida,
    contexto: feedback.contexto || {},
  } as any);

  if (error) return { success: false, error: error.message };

  // Trigger pattern learning in background
  triggerPatternLearning(feedback.entidadTipo, feedback.entidadId, 'explicit');

  return { success: true };
}

/**
 * Record implicit user behavior (clicks, views, selections)
 */
export async function recordImplicitFeedback(feedback: ImplicitFeedback): Promise<{ success: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const { error } = await supabase.from('ai_feedback' as any).insert({
    entidad_tipo: feedback.entidadTipo,
    entidad_id: feedback.entidadId,
    usuario_id: user.id,
    accion: feedback.accion,
    tiempo_visualizacion_ms: feedback.tiempoVisualizacionMs,
    posicion_en_lista: feedback.posicionEnLista,
    seleccionado: feedback.seleccionado,
    contexto: feedback.contexto || {},
  } as any);

  if (!error) {
    triggerPatternLearning(feedback.entidadTipo, feedback.entidadId, 'implicit');
  }

  return { success: !error };
}

/**
 * Track when user views an entity (for implicit learning)
 */
export function trackView(entidadTipo: EntityType, entidadId: string, posicionEnLista?: number) {
  const startTime = Date.now();
  
  // Return cleanup function to record time spent
  return () => {
    const tiempoVisualizacionMs = Date.now() - startTime;
    recordImplicitFeedback({
      entidadTipo,
      entidadId,
      accion: 'viewed',
      tiempoVisualizacionMs,
      posicionEnLista,
    });
  };
}

/**
 * Record match selection (strongest signal for learning)
 */
export async function recordMatchSelection(matchId: string, localId: string, operadorId: string, posicion: number) {
  return recordImplicitFeedback({
    entidadTipo: 'match',
    entidadId: matchId,
    accion: 'selected',
    posicionEnLista: posicion,
    seleccionado: true,
    contexto: { local_id: localId, operador_id: operadorId },
  });
}

/**
 * Record match rejection
 */
export async function recordMatchRejection(matchId: string, motivo?: string) {
  return recordExplicitFeedback({
    entidadTipo: 'match',
    entidadId: matchId,
    feedbackTipo: 'thumbs_down',
    comentario: motivo,
  });
}

/**
 * Record RAG response feedback
 */
export async function recordRAGFeedback(responseId: string, rating: number, correccion?: string) {
  return recordExplicitFeedback({
    entidadTipo: 'rag_response',
    entidadId: responseId,
    rating,
    feedbackTipo: correccion ? 'correction' : 'star_rating',
    correccionSugerida: correccion,
  });
}

/**
 * Trigger background pattern learning (non-blocking)
 */
async function triggerPatternLearning(entidadTipo: string, entidadId: string, source: 'explicit' | 'implicit') {
  try {
    // Create a background task for the learning aggregator
    await supabase.from('ai_agent_tasks').insert({
      agente_tipo: 'learning_aggregator',
      estado: 'pending',
      prioridad: source === 'explicit' ? 7 : 3, // Explicit feedback is higher priority
      entidad_tipo: entidadTipo,
      entidad_id: entidadId,
      parametros: { source, timestamp: new Date().toISOString() },
    });
  } catch (e) {
    console.error('Failed to trigger pattern learning:', e);
  }
}

/**
 * Get feedback stats for an entity
 */
export async function getFeedbackStats(entidadTipo: EntityType, entidadId: string) {
  const { data } = await supabase
    .from('ai_feedback')
    .select('rating, feedback_tipo, accion, seleccionado')
    .eq('entidad_tipo', entidadTipo)
    .eq('entidad_id', entidadId);

  if (!data || data.length === 0) {
    return { totalFeedback: 0, avgRating: null, thumbsUp: 0, thumbsDown: 0, selections: 0 };
  }

  const ratings = data.filter(f => f.rating != null).map(f => f.rating as number);
  const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;

  return {
    totalFeedback: data.length,
    avgRating,
    thumbsUp: data.filter(f => f.feedback_tipo === 'thumbs_up').length,
    thumbsDown: data.filter(f => f.feedback_tipo === 'thumbs_down').length,
    selections: data.filter(f => f.seleccionado).length,
    views: data.filter(f => f.accion === 'viewed').length,
  };
}
