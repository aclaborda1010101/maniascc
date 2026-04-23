CREATE OR REPLACE FUNCTION public.propagar_dominio_chunks_lote(p_limite int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
BEGIN
  WITH cand AS (
    SELECT c.ctid, d.dominio
      FROM document_chunks c
      JOIN documentos_proyecto d ON d.id = c.documento_id
     WHERE d.dominio IS NOT NULL
       AND c.dominio IS DISTINCT FROM d.dominio
     LIMIT p_limite
  )
  UPDATE document_chunks c SET dominio = cand.dominio
    FROM cand WHERE c.ctid = cand.ctid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;

CREATE OR REPLACE FUNCTION public.propagar_dominio_embeddings_lote(p_limite int DEFAULT 5000)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int;
BEGIN
  WITH cand AS (
    SELECT e.ctid, d.dominio
      FROM document_embeddings e
      JOIN documentos_proyecto d ON d.id = e.documento_id
     WHERE d.dominio IS NOT NULL
       AND e.dominio IS DISTINCT FROM d.dominio
     LIMIT p_limite
  )
  UPDATE document_embeddings e SET dominio = cand.dominio
    FROM cand WHERE e.ctid = cand.ctid;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;