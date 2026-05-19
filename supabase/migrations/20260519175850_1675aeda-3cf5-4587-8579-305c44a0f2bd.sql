SET statement_timeout = 0;
ALTER TABLE public.document_chunks DROP COLUMN embedding;
ALTER TABLE public.document_chunks RENAME COLUMN embedding_h TO embedding;