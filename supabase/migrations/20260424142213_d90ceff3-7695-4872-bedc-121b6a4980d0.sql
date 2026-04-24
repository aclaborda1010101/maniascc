-- 1. Tabla entity_narratives
CREATE TABLE public.entity_narratives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('operador','contacto','activo','proyecto','subdivision')),
  entity_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('historia','experiencia_buena','experiencia_mala','negociacion','nota')),
  narrativa text NOT NULL,
  embedding vector(768),
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_narratives_entity ON public.entity_narratives(entity_type, entity_id);
CREATE INDEX idx_narratives_embedding ON public.entity_narratives USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_narratives_created_at ON public.entity_narratives(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER trg_entity_narratives_updated_at
BEFORE UPDATE ON public.entity_narratives
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.entity_narratives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read narratives"
  ON public.entity_narratives FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert their own narratives"
  ON public.entity_narratives FOR INSERT
  TO authenticated
  WITH CHECK (autor_id = auth.uid() OR autor_id IS NULL);

CREATE POLICY "Author or admin can update narratives"
  ON public.entity_narratives FOR UPDATE
  TO authenticated
  USING (autor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Author or admin can delete narratives"
  ON public.entity_narratives FOR DELETE
  TO authenticated
  USING (autor_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 2. rag_hybrid_search ampliado: añade narrativas como fuente
CREATE OR REPLACE FUNCTION public.rag_hybrid_search(
  p_question text,
  p_query_embedding vector,
  p_dominio text DEFAULT NULL,
  p_proyecto_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_dominios text[] DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  documento_id uuid,
  proyecto_id uuid,
  contenido text,
  dominio text,
  metadata jsonb,
  fts_rank real,
  vec_distance real,
  hybrid_score real
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
  narr AS (
    SELECT
      n.id,
      NULL::uuid AS documento_id,
      NULL::uuid AS proyecto_id,
      ('[' || n.tipo || ' · ' || n.entity_type || '] ' || n.narrativa) AS contenido,
      'narrativa'::text AS dominio,
      jsonb_build_object(
        'source', 'narrativa',
        'entity_type', n.entity_type,
        'entity_id', n.entity_id,
        'tipo', n.tipo,
        'autor_id', n.autor_id,
        'created_at', n.created_at
      ) AS metadata,
      ts_rank(to_tsvector('spanish', n.narrativa), plainto_tsquery('spanish', p_question))::real AS fts_rank,
      CASE WHEN n.embedding IS NOT NULL
           THEN (n.embedding <=> p_query_embedding)::real
           ELSE NULL::real END AS vec_distance
    FROM public.entity_narratives n
    WHERE v_include_narr
      AND (
        to_tsvector('spanish', n.narrativa) @@ plainto_tsquery('spanish', p_question)
        OR (n.embedding IS NOT NULL AND (n.embedding <=> p_query_embedding) < 0.40)
      )
    ORDER BY
      CASE WHEN n.embedding IS NOT NULL
           THEN (n.embedding <=> p_query_embedding)
           ELSE 1 END ASC
    LIMIT p_limit
  ),
  unioned AS (
    SELECT * FROM fts
    UNION ALL
    SELECT * FROM vec
    UNION ALL
    SELECT * FROM narr
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