ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE TABLE IF NOT EXISTS public.rag_reprocess_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos_proyecto(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN ('classify','ingest','embed')),
  estado text NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending','processing','done','error')),
  intentos int NOT NULL DEFAULT 0,
  error_msg text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(documento_id, task_type)
);

CREATE INDEX IF NOT EXISTS idx_rag_queue_pending
  ON public.rag_reprocess_queue(task_type, estado, created_at)
  WHERE estado = 'pending';

ALTER TABLE public.rag_reprocess_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gestores admins manage rag queue"
  ON public.rag_reprocess_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_rag_queue_updated_at
  BEFORE UPDATE ON public.rag_reprocess_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();