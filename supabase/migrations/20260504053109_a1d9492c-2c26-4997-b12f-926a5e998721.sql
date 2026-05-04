-- ============================================================
-- 1. rag_hybrid_search v2 (sin columna materializada todavía)
-- ============================================================
DROP FUNCTION IF EXISTS public.rag_hybrid_search(text, vector, text, uuid, integer);
DROP FUNCTION IF EXISTS public.rag_hybrid_search(text, vector, text, uuid, integer, text[]);

CREATE OR REPLACE FUNCTION public.rag_hybrid_search(
  p_question        text,
  p_query_embedding vector,
  p_dominio         text    DEFAULT NULL,
  p_proyecto_id     uuid    DEFAULT NULL,
  p_limit           integer DEFAULT 20,
  p_dominios        text[]  DEFAULT NULL
)
RETURNS TABLE(
  id            uuid,
  documento_id  uuid,
  proyecto_id   uuid,
  contenido     text,
  dominio       text,
  metadata      jsonb,
  owner_id      uuid,
  visibility    text,
  fts_rank      real,
  vec_distance  real,
  hybrid_score  real
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_include_narr boolean := (
    p_dominios IS NULL
    OR 'narrativa' = ANY(p_dominios)
    OR p_dominio IS NULL
    OR p_dominio = 'narrativa'
  );
  v_tsquery tsquery := plainto_tsquery('spanish', p_question);
BEGIN
  RETURN QUERY
  WITH fts AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido,
           c.dominio, c.metadata, c.owner_id, c.visibility,
           ts_rank(to_tsvector('spanish', c.contenido), v_tsquery)::real AS fts_rank,
           NULL::real AS vec_distance
      FROM public.document_chunks c
     WHERE to_tsvector('spanish', c.contenido) @@ v_tsquery
       AND (p_dominios    IS NULL OR c.dominio     = ANY(p_dominios))
       AND (p_dominio     IS NULL OR c.dominio     = p_dominio)
       AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
     ORDER BY fts_rank DESC
     LIMIT p_limit
  ),
  vec AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido,
           c.dominio, c.metadata, c.owner_id, c.visibility,
           NULL::real AS fts_rank,
           (c.embedding <=> p_query_embedding)::real AS vec_distance
      FROM public.document_chunks c
     WHERE c.embedding IS NOT NULL
       AND (p_dominios    IS NULL OR c.dominio     = ANY(p_dominios))
       AND (p_dominio     IS NULL OR c.dominio     = p_dominio)
       AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
     ORDER BY c.embedding <=> p_query_embedding
     LIMIT p_limit
  ),
  narr_fts AS (
    SELECT n.id,
           NULL::uuid AS documento_id, NULL::uuid AS proyecto_id,
           ('[' || n.tipo || ' · ' || n.entity_type || '] ' || n.narrativa) AS contenido,
           'narrativa'::text AS dominio,
           jsonb_build_object(
             'source','narrativa','entity_type',n.entity_type,
             'entity_id',n.entity_id,'tipo',n.tipo,
             'autor_id',n.autor_id,'created_at',n.created_at
           ) AS metadata,
           n.autor_id AS owner_id,
           n.visibility,
           ts_rank(to_tsvector('spanish', n.narrativa), v_tsquery)::real AS fts_rank,
           NULL::real AS vec_distance
      FROM public.entity_narratives n
     WHERE v_include_narr
       AND to_tsvector('spanish', n.narrativa) @@ v_tsquery
     ORDER BY fts_rank DESC
     LIMIT p_limit
  ),
  narr_vec AS (
    SELECT n.id,
           NULL::uuid AS documento_id, NULL::uuid AS proyecto_id,
           ('[' || n.tipo || ' · ' || n.entity_type || '] ' || n.narrativa) AS contenido,
           'narrativa'::text AS dominio,
           jsonb_build_object(
             'source','narrativa','entity_type',n.entity_type,
             'entity_id',n.entity_id,'tipo',n.tipo,
             'autor_id',n.autor_id,'created_at',n.created_at
           ) AS metadata,
           n.autor_id AS owner_id,
           n.visibility,
           NULL::real AS fts_rank,
           (n.embedding <=> p_query_embedding)::real AS vec_distance
      FROM public.entity_narratives n
     WHERE v_include_narr
       AND n.embedding IS NOT NULL
       AND (n.embedding <=> p_query_embedding) < 0.40
     ORDER BY n.embedding <=> p_query_embedding
     LIMIT p_limit
  ),
  unioned AS (
    SELECT * FROM fts
    UNION ALL SELECT * FROM vec
    UNION ALL SELECT * FROM narr_fts
    UNION ALL SELECT * FROM narr_vec
  ),
  scored AS (
    SELECT DISTINCT ON (u.id)
           u.id, u.documento_id, u.proyecto_id,
           u.contenido, u.dominio, u.metadata,
           u.owner_id, u.visibility,
           u.fts_rank, u.vec_distance
      FROM unioned u
     ORDER BY u.id,
              u.fts_rank DESC NULLS LAST,
              u.vec_distance ASC NULLS LAST
  )
  SELECT s.id, s.documento_id, s.proyecto_id,
         s.contenido, s.dominio, s.metadata,
         s.owner_id, s.visibility,
         COALESCE(s.fts_rank, 0)::real     AS fts_rank,
         COALESCE(s.vec_distance, 1)::real AS vec_distance,
         (COALESCE(s.fts_rank, 0) * 0.4
          + (1 - COALESCE(s.vec_distance, 1)) * 0.6)::real AS hybrid_score
    FROM scored s
   ORDER BY hybrid_score DESC
   LIMIT p_limit;
END;
$$;

-- ============================================================
-- 2. Revocar EXECUTE público de funciones SECURITY DEFINER del cache
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.get_cached_embedding(text)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cached_embedding(text)         FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cached_embedding(text)         FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cache_query_embedding(text,vector) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cache_query_embedding(text,vector) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cache_query_embedding(text,vector) FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.cleanup_query_cache()              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_query_cache()              FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_query_cache()              FROM authenticated;

GRANT EXECUTE ON FUNCTION public.get_cached_embedding(text)         TO service_role;
GRANT EXECUTE ON FUNCTION public.cache_query_embedding(text,vector) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_query_cache()              TO service_role;