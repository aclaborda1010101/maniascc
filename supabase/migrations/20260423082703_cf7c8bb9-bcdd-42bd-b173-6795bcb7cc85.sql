-- Extender rag_hybrid_search para aceptar lista de dominios (array)
-- mantiene compatibilidad: si p_dominios es NULL, usa p_dominio (compat antigua)
CREATE OR REPLACE FUNCTION public.rag_hybrid_search(
  p_question text,
  p_query_embedding vector,
  p_dominio text DEFAULT NULL,
  p_proyecto_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_dominios text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid, documento_id uuid, proyecto_id uuid,
  contenido text, dominio text, metadata jsonb,
  fts_rank real, vec_distance real, hybrid_score real
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH fts AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido, c.dominio, c.metadata,
           ts_rank(to_tsvector('spanish', c.contenido), plainto_tsquery('spanish', p_question))::real AS fts_rank,
           NULL::real AS vec_distance
    FROM public.document_chunks c
    WHERE to_tsvector('spanish', c.contenido) @@ plainto_tsquery('spanish', p_question)
      AND (p_dominios IS NULL OR c.dominio = ANY(p_dominios))
      AND (p_dominio IS NULL OR c.dominio = p_dominio)
      AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
    ORDER BY fts_rank DESC
    LIMIT p_limit
  ),
  vec AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido, c.dominio, c.metadata,
           NULL::real AS fts_rank,
           (c.embedding <=> p_query_embedding)::real AS vec_distance
    FROM public.document_chunks c
    WHERE c.embedding IS NOT NULL
      AND (p_dominios IS NULL OR c.dominio = ANY(p_dominios))
      AND (p_dominio IS NULL OR c.dominio = p_dominio)
      AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_limit
  ),
  unioned AS (
    SELECT * FROM fts
    UNION ALL
    SELECT * FROM vec
  )
  SELECT u.id, u.documento_id, u.proyecto_id, u.contenido, u.dominio, u.metadata,
         COALESCE(MAX(u.fts_rank), 0)::real AS fts_rank,
         COALESCE(MIN(u.vec_distance), 1)::real AS vec_distance,
         (COALESCE(MAX(u.fts_rank), 0) * 0.4 + (1 - COALESCE(MIN(u.vec_distance), 1)) * 0.6)::real AS hybrid_score
  FROM unioned u
  GROUP BY u.id, u.documento_id, u.proyecto_id, u.contenido, u.dominio, u.metadata
  ORDER BY hybrid_score DESC
  LIMIT p_limit;
END;
$function$;