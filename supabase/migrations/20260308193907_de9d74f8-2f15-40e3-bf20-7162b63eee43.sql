
-- Table for document chunks with full-text search
CREATE TABLE public.document_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid REFERENCES public.documentos_proyecto(id) ON DELETE CASCADE,
  proyecto_id uuid REFERENCES public.proyectos(id) ON DELETE CASCADE,
  contenido text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  chunk_index integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- GIN index for Spanish full-text search
CREATE INDEX idx_document_chunks_fts ON public.document_chunks
  USING GIN (to_tsvector('spanish', contenido));

CREATE INDEX idx_document_chunks_proyecto ON public.document_chunks (proyecto_id);
CREATE INDEX idx_document_chunks_documento ON public.document_chunks (documento_id);

-- RLS
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view document_chunks"
  ON public.document_chunks FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Gestores admins can insert document_chunks"
  ON public.document_chunks FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can delete document_chunks"
  ON public.document_chunks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
