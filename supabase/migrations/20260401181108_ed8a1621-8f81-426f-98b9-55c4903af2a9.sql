
CREATE TABLE public.playground_evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  variante_index INTEGER NOT NULL,
  variante_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  respuesta TEXT NOT NULL,
  latencia_ms INTEGER DEFAULT 0,
  fuentes_consultadas INTEGER DEFAULT 0,
  tools_used JSONB DEFAULT '[]'::jsonb,
  evaluacion TEXT CHECK (evaluacion IN ('mejor', 'buena', 'mala', 'parcial')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.playground_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own evaluations" ON public.playground_evaluations
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);

CREATE POLICY "Users can insert own evaluations" ON public.playground_evaluations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Users can update own evaluations" ON public.playground_evaluations
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id);
