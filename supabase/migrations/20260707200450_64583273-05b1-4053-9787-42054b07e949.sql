CREATE OR REPLACE FUNCTION public.rag_hybrid_search(
  p_question text,
  p_query_embedding vector,
  p_dominio text DEFAULT NULL::text,
  p_proyecto_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 20,
  p_dominios text[] DEFAULT NULL::text[],
  p_user_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, documento_id uuid, proyecto_id uuid, contenido text,
  dominio text, metadata jsonb, owner_id uuid, visibility text,
  fts_rank real, vec_distance real, hybrid_score real
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_include_narr boolean := (
    p_dominios IS NULL
    OR 'narrativa' = ANY(p_dominios)
    OR p_dominio IS NULL
    OR p_dominio = 'narrativa'
  );
  v_tsquery tsquery;
  v_plain_txt text;
  v_qemb_h halfvec(768) := p_query_embedding::halfvec(768);
  v_wide integer := 60;
  v_k    integer := 60;
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);

  -- OR de lexemas: plainto_tsquery ya stemmiza en español y elimina stopwords;
  -- sustituimos ' & ' por ' | ' para semántica OR (ts_rank prioriza los chunks
  -- que casan MÁS términos). Si algo falla → v_tsquery = NULL (rama FTS vacía).
  BEGIN
    v_plain_txt := plainto_tsquery('spanish', COALESCE(p_question, ''))::text;
    IF v_plain_txt IS NULL OR btrim(v_plain_txt) = '' THEN
      v_tsquery := NULL;
    ELSE
      v_tsquery := replace(v_plain_txt, ' & ', ' | ')::tsquery;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_tsquery := NULL;
  END;

  RETURN QUERY
  WITH fts AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido,
           c.dominio, c.metadata, c.owner_id, c.visibility,
           ts_rank(to_tsvector('spanish', c.contenido), v_tsquery)::real AS fts_rank,
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('spanish', c.contenido), v_tsquery) DESC
           )::int AS rnk
      FROM public.document_chunks c
     WHERE v_tsquery IS NOT NULL
       AND to_tsvector('spanish', c.contenido) @@ v_tsquery
       AND (p_dominios    IS NULL OR c.dominio     = ANY(p_dominios))
       AND (p_dominio     IS NULL OR c.dominio     = p_dominio)
       AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
       AND (p_user_id IS NULL
            OR c.visibility IN ('shared','global')
            OR c.owner_id = p_user_id)
       AND COALESCE(c.metadata->>'extraction_method','') NOT IN ('metadata_fallback','error_fallback')
     ORDER BY fts_rank DESC
     LIMIT v_wide
  ),
  vec AS (
    SELECT c.id, c.documento_id, c.proyecto_id, c.contenido,
           c.dominio, c.metadata, c.owner_id, c.visibility,
           (c.embedding <=> v_qemb_h)::real AS vec_distance,
           row_number() OVER (ORDER BY c.embedding <=> v_qemb_h ASC)::int AS rnk
      FROM public.document_chunks c
     WHERE c.embedding IS NOT NULL
       AND (p_dominios    IS NULL OR c.dominio     = ANY(p_dominios))
       AND (p_dominio     IS NULL OR c.dominio     = p_dominio)
       AND (p_proyecto_id IS NULL OR c.proyecto_id = p_proyecto_id)
       AND (p_user_id IS NULL
            OR c.visibility IN ('shared','global')
            OR c.owner_id = p_user_id)
       AND COALESCE(c.metadata->>'extraction_method','') NOT IN ('metadata_fallback','error_fallback')
     ORDER BY c.embedding <=> v_qemb_h
     LIMIT v_wide
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
           row_number() OVER (
             ORDER BY ts_rank(to_tsvector('spanish', n.narrativa), v_tsquery) DESC
           )::int AS rnk
      FROM public.entity_narratives n
     WHERE v_include_narr
       AND v_tsquery IS NOT NULL
       AND to_tsvector('spanish', n.narrativa) @@ v_tsquery
       AND (p_user_id IS NULL
            OR n.visibility IN ('shared','global')
            OR n.autor_id = p_user_id)
     ORDER BY fts_rank DESC
     LIMIT v_wide
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
           (n.embedding <=> p_query_embedding)::real AS vec_distance,
           row_number() OVER (ORDER BY n.embedding <=> p_query_embedding ASC)::int AS rnk
      FROM public.entity_narratives n
     WHERE v_include_narr
       AND n.embedding IS NOT NULL
       AND (n.embedding <=> p_query_embedding) < 0.55
       AND (p_user_id IS NULL
            OR n.visibility IN ('shared','global')
            OR n.autor_id = p_user_id)
     ORDER BY n.embedding <=> p_query_embedding
     LIMIT v_wide
  ),
  chunk_ids AS (
    SELECT id FROM fts UNION SELECT id FROM vec
  ),
  chunks_agg AS (
    SELECT
      ci.id,
      COALESCE(f.documento_id, v.documento_id)                       AS documento_id,
      COALESCE(f.proyecto_id,  v.proyecto_id)                        AS proyecto_id,
      COALESCE(f.contenido,    v.contenido)                          AS contenido,
      COALESCE(f.dominio,      v.dominio)                            AS dominio,
      COALESCE(f.metadata,     v.metadata)                           AS metadata,
      COALESCE(f.owner_id,     v.owner_id)                           AS owner_id,
      COALESCE(f.visibility,   v.visibility)                         AS visibility,
      COALESCE(f.fts_rank, 0)::real                                  AS fts_rank,
      COALESCE(v.vec_distance, 1)::real                              AS vec_distance,
      (CASE WHEN f.rnk IS NOT NULL THEN 1.0/(v_k + f.rnk) ELSE 0 END
       + CASE WHEN v.rnk IS NOT NULL THEN 1.0/(v_k + v.rnk) ELSE 0 END)::real AS hybrid_score
    FROM chunk_ids ci
    LEFT JOIN fts f ON f.id = ci.id
    LEFT JOIN vec v ON v.id = ci.id
  ),
  narr_ids AS (
    SELECT id FROM narr_fts UNION SELECT id FROM narr_vec
  ),
  narr_agg AS (
    SELECT
      ni.id,
      COALESCE(nf.documento_id, nv.documento_id)                     AS documento_id,
      COALESCE(nf.proyecto_id,  nv.proyecto_id)                      AS proyecto_id,
      COALESCE(nf.contenido,    nv.contenido)                        AS contenido,
      COALESCE(nf.dominio,      nv.dominio)                          AS dominio,
      COALESCE(nf.metadata,     nv.metadata)                         AS metadata,
      COALESCE(nf.owner_id,     nv.owner_id)                         AS owner_id,
      COALESCE(nf.visibility,   nv.visibility)                       AS visibility,
      COALESCE(nf.fts_rank, 0)::real                                 AS fts_rank,
      COALESCE(nv.vec_distance, 1)::real                             AS vec_distance,
      (CASE WHEN nf.rnk IS NOT NULL THEN 1.0/(v_k + nf.rnk) ELSE 0 END
       + CASE WHEN nv.rnk IS NOT NULL THEN 1.0/(v_k + nv.rnk) ELSE 0 END)::real AS hybrid_score
    FROM narr_ids ni
    LEFT JOIN narr_fts nf ON nf.id = ni.id
    LEFT JOIN narr_vec nv ON nv.id = ni.id
  ),
  all_rows AS (
    SELECT * FROM chunks_agg
    UNION ALL
    SELECT * FROM narr_agg
  )
  SELECT a.id, a.documento_id, a.proyecto_id, a.contenido, a.dominio,
         a.metadata, a.owner_id, a.visibility,
         a.fts_rank, a.vec_distance, a.hybrid_score
    FROM all_rows a
   ORDER BY a.hybrid_score DESC
   LIMIT p_limit;
END;
$function$;