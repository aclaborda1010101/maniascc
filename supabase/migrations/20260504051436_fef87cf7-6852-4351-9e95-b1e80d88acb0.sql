-- Índice GIN de FTS en entity_narratives
CREATE INDEX IF NOT EXISTS idx_narratives_fts
  ON public.entity_narratives
  USING gin(to_tsvector('spanish', narrativa));

-- Tabla de cache
CREATE TABLE IF NOT EXISTS public.query_embeddings_cache (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash   text NOT NULL UNIQUE,
  query_text   text NOT NULL,
  embedding    vector(768) NOT NULL,
  hit_count    integer NOT NULL DEFAULT 1,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

COMMENT ON TABLE public.query_embeddings_cache IS
  'Cache de embeddings RAG. Modelo actual: google/text-embedding-004 (768d). TRUNCATE si se cambia el modelo.';

CREATE INDEX IF NOT EXISTS idx_qec_hash    ON public.query_embeddings_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_qec_expires ON public.query_embeddings_cache(expires_at);

ALTER TABLE public.query_embeddings_cache ENABLE ROW LEVEL SECURITY;
-- Sin políticas: solo accesible vía service_role / RPC SECURITY DEFINER.

-- Funciones de cache
CREATE OR REPLACE FUNCTION public.get_cached_embedding(p_query text)
RETURNS vector
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash      text;
  v_embedding vector;
BEGIN
  v_hash := encode(
    extensions.digest(lower(trim(regexp_replace(p_query, '\s+', ' ', 'g'))), 'sha256'),
    'hex'
  );

  UPDATE public.query_embeddings_cache
     SET hit_count    = hit_count + 1,
         last_used_at = now(),
         expires_at   = now() + interval '7 days'
   WHERE query_hash = v_hash
     AND expires_at > now()
  RETURNING embedding INTO v_embedding;

  RETURN v_embedding;
END;
$$;

CREATE OR REPLACE FUNCTION public.cache_query_embedding(
  p_query     text,
  p_embedding vector
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_hash text;
BEGIN
  v_hash := encode(
    extensions.digest(lower(trim(regexp_replace(p_query, '\s+', ' ', 'g'))), 'sha256'),
    'hex'
  );

  INSERT INTO public.query_embeddings_cache (query_hash, query_text, embedding)
  VALUES (v_hash, p_query, p_embedding)
  ON CONFLICT (query_hash) DO UPDATE SET
    embedding    = EXCLUDED.embedding,
    hit_count    = public.query_embeddings_cache.hit_count + 1,
    last_used_at = now(),
    expires_at   = now() + interval '7 days';
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_query_cache()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM public.query_embeddings_cache WHERE expires_at < now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Cron diario de limpieza (4:00 AM UTC)
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-query-embeddings-cache');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-query-embeddings-cache',
  '0 4 * * *',
  $$SELECT public.cleanup_query_cache()$$
);