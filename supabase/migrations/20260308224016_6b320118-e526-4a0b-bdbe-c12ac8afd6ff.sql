-- Add domain column to document_chunks for segmented RAG
ALTER TABLE public.document_chunks ADD COLUMN IF NOT EXISTS dominio text NOT NULL DEFAULT 'general';

-- Create index for domain-specific queries
CREATE INDEX IF NOT EXISTS idx_document_chunks_dominio ON public.document_chunks (dominio);

-- Add combined index for domain + proyecto
CREATE INDEX IF NOT EXISTS idx_document_chunks_dominio_proyecto ON public.document_chunks (dominio, proyecto_id);