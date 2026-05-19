SET statement_timeout = 0;
SET maintenance_work_mem = '512MB';
CREATE INDEX IF NOT EXISTS document_chunks_embedding_hnsw_idx
  ON public.document_chunks
  USING hnsw (embedding halfvec_cosine_ops)
  WITH (m = 8, ef_construction = 32);