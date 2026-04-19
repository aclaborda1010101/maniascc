-- Tabla histórico de documentos generados por el FORGE
CREATE TABLE public.documentos_generados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  mode TEXT NOT NULL,
  mode_label TEXT NOT NULL,
  titulo TEXT,
  contexto TEXT,
  structured_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  proyecto_id UUID,
  storage_path TEXT,
  modelo TEXT,
  latencia_ms INTEGER,
  documento_proyecto_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_documentos_generados_owner ON public.documentos_generados(owner_id);
CREATE INDEX idx_documentos_generados_proyecto ON public.documentos_generados(proyecto_id);
CREATE INDEX idx_documentos_generados_created ON public.documentos_generados(created_at DESC);

ALTER TABLE public.documentos_generados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View documentos_generados by visibility or ownership"
  ON public.documentos_generados FOR SELECT
  TO authenticated
  USING (
    visibility = ANY (ARRAY['shared'::text, 'global'::text])
    OR owner_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Gestores admins insert documentos_generados"
  ON public.documentos_generados FOR INSERT
  TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
    AND owner_id = auth.uid()
  );

CREATE POLICY "Owner or admin update documentos_generados"
  ON public.documentos_generados FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete documentos_generados"
  ON public.documentos_generados FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_documentos_generados_updated_at
  BEFORE UPDATE ON public.documentos_generados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket privado
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos_generados', 'documentos_generados', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: archivos en carpetas por user_id
CREATE POLICY "Users view own generated docs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos_generados'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Users upload own generated docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos_generados'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users delete own generated docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos_generados'
    AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(), 'admin'::app_role))
  );