
ALTER TABLE public.golden_questions ADD COLUMN IF NOT EXISTS expected_sql text;

CREATE OR REPLACE FUNCTION public.golden_eval_sql(p_sql text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_result text;
BEGIN
  IF p_sql IS NULL OR btrim(p_sql) = '' THEN RETURN NULL; END IF;
  IF NOT (lower(btrim(p_sql)) LIKE 'select%' OR lower(btrim(p_sql)) LIKE 'with%') THEN
    RETURN NULL;
  END IF;
  EXECUTE p_sql INTO v_result;
  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.golden_eval_sql(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.golden_eval_sql(text) TO service_role;

UPDATE public.golden_questions SET expected_sql = 'SELECT count(*)::text FROM locales' WHERE code='F1';
UPDATE public.golden_questions SET expected_sql = 'SELECT round(COALESCE(sum(superficie_m2),0))::text FROM locales' WHERE code='F3';
