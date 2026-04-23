-- Añadir columna dominio a documentos_proyecto para clasificación por dominio
ALTER TABLE public.documentos_proyecto
  ADD COLUMN IF NOT EXISTS dominio text;

-- Índice parcial para filtros rápidos por dominio
CREATE INDEX IF NOT EXISTS idx_documentos_proyecto_dominio
  ON public.documentos_proyecto (dominio)
  WHERE dominio IS NOT NULL;

-- Asegurar índice en document_chunks.dominio (idempotente)
CREATE INDEX IF NOT EXISTS idx_document_chunks_dominio
  ON public.document_chunks (dominio)
  WHERE dominio IS NOT NULL;