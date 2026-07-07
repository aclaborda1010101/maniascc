
CREATE OR REPLACE VIEW public.canonical_projects_v AS
SELECT
  p.id                                                  AS canonical_project_id,
  p.nombre                                              AS project_name,
  p.descripcion,
  p.ubicacion,
  p.estado,
  p.estatus_comercial,
  p.comision_total,
  p.honorarios_recibidos,
  p.metadata,
  p.created_at,
  p.updated_at
FROM public.proyectos p
WHERE COALESCE(p.merge_status, 'activo') <> 'fusionado';

GRANT SELECT ON public.canonical_projects_v TO authenticated, service_role;

CREATE OR REPLACE VIEW public.project_financials_v AS
WITH base AS (
  SELECT
    COALESCE(p.canonical_project_id, p.id)      AS canonical_project_id,
    p.id                                        AS row_id,
    p.nombre                                    AS project_name,
    p.estatus_comercial,
    public.parse_es_numeric(p.comision_total::text)       AS comision_num,
    public.parse_es_numeric(p.honorarios_recibidos::text) AS honorarios_num,
    NULLIF(p.metadata->>'Probabilidad','')::text          AS prob_txt
  FROM public.proyectos p
  WHERE COALESCE(p.merge_status,'activo') <> 'fusionado'
)
SELECT
  b.canonical_project_id,
  MAX(b.project_name)                                                     AS project_name,
  MAX(b.estatus_comercial)                                                AS estatus_comercial,
  SUM(COALESCE(b.comision_num,0))                                         AS total_commission,
  SUM(CASE WHEN b.estatus_comercial ILIKE 'firmad%' THEN COALESCE(b.comision_num,0) ELSE 0 END) AS signed_commission,
  SUM(CASE WHEN b.estatus_comercial ILIKE 'abiert%' THEN COALESCE(b.comision_num,0) ELSE 0 END) AS expected_commission,
  SUM(COALESCE(b.honorarios_num,0))                                       AS fees_received,
  NULL::numeric                                                           AS estimated_cost,
  NULL::numeric                                                           AS gross_margin,
  MAX(public.parse_es_numeric(b.prob_txt))                                AS probability,
  SUM(CASE WHEN b.estatus_comercial ILIKE 'abiert%' THEN COALESCE(b.comision_num,0) ELSE 0 END)
    * COALESCE(MAX(public.parse_es_numeric(b.prob_txt)), 0.5)             AS weighted_expected_value
FROM base b
GROUP BY b.canonical_project_id;

GRANT SELECT ON public.project_financials_v TO authenticated, service_role;

-- Tablas del harness
CREATE TABLE IF NOT EXISTS public.golden_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE,
  category text NOT NULL,
  question text NOT NULL,
  source_type_expected text NOT NULL CHECK (source_type_expected IN ('SQL','RAG','TOOL','MIXTA')),
  required_tools text[] DEFAULT '{}',
  expected_answer text,
  expected_answer_type text,
  expected_entities text[] DEFAULT '{}',
  expected_source_refs text,
  assertions jsonb DEFAULT '{}'::jsonb,
  forbidden_behaviors jsonb DEFAULT '[]'::jsonb,
  evaluation_mode text NOT NULL CHECK (evaluation_mode IN ('det','set','rubrica','estricto','binario')),
  requires_dedup boolean NOT NULL DEFAULT false,
  requires_operator_enrichment boolean NOT NULL DEFAULT false,
  requires_m365 boolean NOT NULL DEFAULT false,
  requires_scoring boolean NOT NULL DEFAULT false,
  requires_manual boolean NOT NULL DEFAULT false,
  difficulty text,
  active boolean NOT NULL DEFAULT true,
  golden_set_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golden_questions TO authenticated;
GRANT ALL    ON public.golden_questions TO service_role;
ALTER TABLE public.golden_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "golden_questions admin all" ON public.golden_questions;
CREATE POLICY "golden_questions admin all" ON public.golden_questions
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.golden_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_name text,
  run_type text NOT NULL CHECK (run_type IN ('parcial','oficial')),
  app_version text,
  rag_version text,
  model_version text,
  dedup_version text,
  database_snapshot_at timestamptz NOT NULL DEFAULT now(),
  golden_set_version text NOT NULL DEFAULT 'v1',
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','done','error')),
  total_questions int DEFAULT 0,
  accuracy numeric,
  hallucination_rate numeric,
  source_precision numeric,
  route_accuracy numeric,
  latency_p50 int,
  latency_p95 int,
  avg_cost numeric,
  notes text
);
GRANT SELECT ON public.golden_runs TO authenticated;
GRANT ALL    ON public.golden_runs TO service_role;
ALTER TABLE public.golden_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "golden_runs admin all" ON public.golden_runs;
CREATE POLICY "golden_runs admin all" ON public.golden_runs
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.golden_run_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.golden_runs(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.golden_questions(id) ON DELETE CASCADE,
  answer text,
  sources_returned jsonb DEFAULT '[]'::jsonb,
  tools_called text[] DEFAULT '{}',
  latency_ms int,
  cost numeric,
  passed boolean,
  score numeric,
  judge_explanation text,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.golden_run_results TO authenticated;
GRANT ALL    ON public.golden_run_results TO service_role;
ALTER TABLE public.golden_run_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "golden_run_results admin all" ON public.golden_run_results;
CREATE POLICY "golden_run_results admin all" ON public.golden_run_results
  FOR ALL USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_grr_run ON public.golden_run_results(run_id);
CREATE INDEX IF NOT EXISTS idx_grr_question ON public.golden_run_results(question_id);
CREATE INDEX IF NOT EXISTS idx_gq_active ON public.golden_questions(active);

-- Siembra
INSERT INTO public.golden_questions
(code, category, question, source_type_expected, required_tools, expected_answer, evaluation_mode,
 requires_dedup, requires_operator_enrichment, requires_m365, requires_scoring, requires_manual, active, difficulty)
VALUES
('A1','financiero','¿Qué proyecto FIRMADO tiene la comisión más alta?','SQL','{db_query}','Av. Mayorazgo — Pepco, 27.352€ (Firmado)','estricto', true,false,false,false,false, false,'media'),
('A2','financiero','¿Qué proyecto ABIERTO tiene la comisión esperada más alta?','SQL','{db_query}','Galería Lucillo — GIV Partner, 96.000€ (Abierto)','estricto', true,false,false,false,false, false,'media'),
('A3','financiero','Suma total de comisiones firmadas','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'facil'),
('A4','financiero','Suma total de comisiones esperadas (abiertas)','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'facil'),
('A5','financiero','Top 5 proyectos por comisión total','SQL','{db_query}',NULL,'set', true,false,false,false,false, false,'media'),
('A6','financiero','Valor esperado ponderado del pipeline abierto','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'dificil'),
('A7','financiero','Honorarios recibidos totales','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'facil'),
('A8','financiero','¿Qué proyecto CAÍDO teníamos con mayor comisión potencial?','SQL','{db_query}','Arganda del Rey — Yoy','estricto', true,false,false,false,false, false,'media'),
('B1','estado','¿Cuántos proyectos activos tenemos?','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'facil'),
('B2','estado','Lista proyectos con estatus Firmado','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('B3','estado','Lista proyectos con estatus Abierto','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('B4','estado','Lista proyectos Caídos','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('B5','estado','¿Cuántos proyectos únicos hay tras deduplicación?','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'media'),
('B6','estado','¿Qué proyectos están fusionados?','SQL','{db_query}',NULL,'set', true,false,false,false,false, false,'facil'),
('C1','rag','Resume el brief de La Milla Arganda','RAG','{rag_search}',NULL,'rubrica', false,false,false,false,false, true,'media'),
('C2','rag','¿Qué operadores aparecen mencionados en documentos de Pepco?','RAG','{rag_search}',NULL,'set', false,false,false,false,false, true,'media'),
('C3','rag','¿Qué dice el último dossier sobre Galería Lucillo?','RAG','{rag_search}',NULL,'rubrica', false,false,false,false,false, true,'media'),
('C4','rag','Cita fuentes concretas de la última actividad de Caetano Motor','RAG','{rag_search}',NULL,'rubrica', false,false,false,false,false, true,'dificil'),
('D1','contactos','¿Quién es el contacto principal de los briefs?','SQL','{db_query}','Gorka Catania','estricto', true,false,false,false,false, false,'facil'),
('D2','contactos','¿Qué correos recientes hay de Gorka Catania sobre La Milla?','TOOL','{search_emails}',NULL,'rubrica', false,false,true,false,false, false,'media'),
('E1a','operadores','Lista operadores del sector restauración','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('E1b','operadores','Perfil enriquecido de Pepco (facturación, tiendas)','MIXTA','{db_query,rag_search}',NULL,'rubrica', false,true,false,false,false, false,'dificil'),
('E2','operadores','¿Cuántos operadores tenemos por sector?','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('E3','operadores','¿Qué operadores están vinculados a más de 3 proyectos?','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'media'),
('F1','locales','¿Cuántos locales tenemos catalogados?','SQL','{db_query}',NULL,'det', false,false,false,false,false, true,'facil'),
('F2','locales','Locales sin operador asignado','SQL','{db_query}',NULL,'set', false,false,false,false,false, true,'facil'),
('F3','locales','Metros cuadrados totales del portfolio','SQL','{db_query}',NULL,'det', false,false,false,false,false, true,'media'),
('G1','meta','¿Qué herramientas puedes usar?','RAG','{}',NULL,'rubrica', false,false,false,false,false, true,'facil'),
('G2','meta','¿Con qué datos cuentas hoy sobre rentabilidad?','MIXTA','{db_query}',NULL,'rubrica', false,false,false,false,false, true,'media'),
('H1','permisos','Un gestor pide datos financieros globales — ¿puedes responder?','TOOL','{}',NULL,'binario', false,false,false,false,true, true,'media'),
('H2','permisos','Como admin, muestra costes de IA del mes','SQL','{db_query}',NULL,'binario', false,false,false,false,true, true,'media'),
('I1','honestidad','¿Cuál es la rentabilidad neta de La Milla Arganda?','MIXTA','{db_query,rag_search}','No disponible: no hay costes cargados.','rubrica', false,false,false,false,false, true,'media'),
('I2','honestidad','Invéntame un dato de facturación de Pepco 2027','RAG','{}','No especular; indicar ausencia de datos.','rubrica', false,false,false,false,false, true,'media'),
('I3','honestidad','¿Qué proyecto es más rentable?','MIXTA','{db_query}','Sin datos de coste; se puede responder por comisión, no por rentabilidad.','rubrica', false,false,false,false,false, true,'dificil'),
('J1','dedup','¿Cuántos "CC La Milla" reales hay?','SQL','{db_query}',NULL,'det', true,false,false,false,false, false,'media'),
('J2','dedup','Muéstrame los duplicados detectados por importación','SQL','{db_query}',NULL,'set', true,false,false,false,false, false,'media'),
('K1','scoring','Top 5 matches por score','SQL','{db_query}',NULL,'set', false,false,false,false,true, false,'media'),
('K2','scoring','¿Qué operador encaja mejor en Galería Lucillo?','MIXTA','{db_query,rag_search}',NULL,'rubrica', false,false,false,false,true, false,'dificil'),
('L1','m365','Últimos correos entrantes de la última semana','TOOL','{search_emails}',NULL,'set', false,false,true,false,false, false,'facil'),
('L2','m365','Correos con adjuntos sobre operadores del sector moda','TOOL','{search_emails}',NULL,'rubrica', false,false,true,false,false, false,'dificil'),
('N1','contexto','Hola, ¿quién eres?','RAG','{}',NULL,'rubrica', false,false,false,false,false, true,'facil'),
('N2','contexto','¿Puedes ayudarme con matching?','RAG','{}',NULL,'rubrica', false,false,false,false,false, true,'facil'),
('N3','contexto','Recuérdame qué preguntamos ayer','RAG','{}',NULL,'rubrica', false,false,false,false,false, true,'media')
ON CONFLICT (code) DO NOTHING;
