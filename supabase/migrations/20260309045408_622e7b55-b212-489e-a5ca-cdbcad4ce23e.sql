-- V4: SISTEMA DE APRENDIZAJE CONTINUO E IA AVANZADA

-- 1. TABLA DE FEEDBACK EXPLÍCITO E IMPLÍCITO
CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo text NOT NULL,
  entidad_id uuid NOT NULL,
  usuario_id uuid,
  rating integer CHECK (rating BETWEEN 1 AND 5),
  feedback_tipo text,
  comentario text,
  correccion_sugerida text,
  accion text,
  tiempo_visualizacion_ms integer,
  posicion_en_lista integer,
  seleccionado boolean DEFAULT false,
  contexto jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- 2. TABLA DE PATRONES APRENDIDOS
CREATE TABLE IF NOT EXISTS public.ai_learned_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patron_tipo text NOT NULL,
  patron_key text NOT NULL,
  patron_descripcion text,
  score_ajuste numeric DEFAULT 0,
  confianza numeric DEFAULT 0.5 CHECK (confianza BETWEEN 0 AND 1),
  num_observaciones integer DEFAULT 0,
  tasa_exito numeric DEFAULT 0,
  datos_agregados jsonb DEFAULT '{}'::jsonb,
  ejemplos_recientes jsonb DEFAULT '[]'::jsonb,
  activo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(patron_tipo, patron_key)
);

-- 3. TABLA DE AGENTES AUTÓNOMOS
CREATE TABLE IF NOT EXISTS public.ai_agent_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agente_tipo text NOT NULL,
  estado text DEFAULT 'pending',
  prioridad integer DEFAULT 5,
  entidad_tipo text,
  entidad_id uuid,
  parametros jsonb DEFAULT '{}'::jsonb,
  resultado jsonb,
  sugerencias jsonb DEFAULT '[]'::jsonb,
  insights_generados jsonb DEFAULT '[]'::jsonb,
  intentos integer DEFAULT 0,
  max_intentos integer DEFAULT 3,
  error_mensaje text,
  iniciado_en timestamptz,
  completado_en timestamptz,
  modelo_usado text,
  tokens_consumidos integer DEFAULT 0,
  coste_estimado numeric DEFAULT 0,
  creado_por uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. TABLA DE INSIGHTS Y OPORTUNIDADES
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  severidad text DEFAULT 'info',
  titulo text NOT NULL,
  descripcion text NOT NULL,
  proyecto_id uuid,
  entidades_relacionadas jsonb DEFAULT '[]'::jsonb,
  acciones_sugeridas jsonb DEFAULT '[]'::jsonb,
  estado text DEFAULT 'nuevo',
  feedback_usuario text,
  accion_tomada text,
  confianza numeric DEFAULT 0.7,
  impacto_estimado text,
  generado_por_tarea_id uuid,
  modelo_usado text,
  visto_en timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 5. MODELO PREDICTIVO DE MATCHES
CREATE TABLE IF NOT EXISTS public.match_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id uuid,
  operador_id uuid,
  score_base integer DEFAULT 0,
  score_ajustado integer DEFAULT 0,
  score_predictivo integer DEFAULT 0,
  score_final integer DEFAULT 0,
  ajuste_historico numeric DEFAULT 0,
  ajuste_feedback numeric DEFAULT 0,
  ajuste_sector numeric DEFAULT 0,
  ajuste_zona numeric DEFAULT 0,
  probabilidad_exito numeric DEFAULT 0.5,
  tiempo_estimado_cierre integer,
  factores_positivos jsonb DEFAULT '[]'::jsonb,
  factores_negativos jsonb DEFAULT '[]'::jsonb,
  comparables_usados jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  UNIQUE(local_id, operador_id)
);

-- 6. DOCUMENT EMBEDDINGS
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id uuid,
  documento_id uuid,
  proyecto_id uuid,
  embedding_json jsonb,
  modelo_embedding text DEFAULT 'text-embedding',
  contenido_normalizado text,
  keywords text[],
  entidades_detectadas jsonb DEFAULT '[]'::jsonb,
  dominio text DEFAULT 'general',
  relevancia_calculada numeric DEFAULT 0.5,
  created_at timestamptz DEFAULT now()
);

-- 7. ÍNDICES
CREATE INDEX IF NOT EXISTS idx_ai_feedback_entidad ON public.ai_feedback(entidad_tipo, entidad_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_usuario ON public.ai_feedback(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ai_learned_patterns_tipo ON public.ai_learned_patterns(patron_tipo, activo);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_estado ON public.ai_agent_tasks(estado, prioridad DESC);
CREATE INDEX IF NOT EXISTS idx_ai_insights_proyecto ON public.ai_insights(proyecto_id, estado);
CREATE INDEX IF NOT EXISTS idx_match_predictions_local ON public.match_predictions(local_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_proyecto ON public.document_embeddings(proyecto_id, dominio);

-- 8. RLS
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learned_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can insert own feedback" ON public.ai_feedback FOR INSERT WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Users can view feedback" ON public.ai_feedback FOR SELECT USING (true);
CREATE POLICY "Authenticated can view patterns" ON public.ai_learned_patterns FOR SELECT USING (true);
CREATE POLICY "Gestores can manage patterns" ON public.ai_learned_patterns FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Authenticated can view tasks" ON public.ai_agent_tasks FOR SELECT USING (true);
CREATE POLICY "Gestores can insert tasks" ON public.ai_agent_tasks FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores can update tasks" ON public.ai_agent_tasks FOR UPDATE USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Authenticated can view insights" ON public.ai_insights FOR SELECT USING (true);
CREATE POLICY "Gestores can manage insights" ON public.ai_insights FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Authenticated can view predictions" ON public.match_predictions FOR SELECT USING (true);
CREATE POLICY "Gestores can manage predictions" ON public.match_predictions FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Authenticated can view embeddings" ON public.document_embeddings FOR SELECT USING (true);
CREATE POLICY "Gestores can manage embeddings" ON public.document_embeddings FOR ALL USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));