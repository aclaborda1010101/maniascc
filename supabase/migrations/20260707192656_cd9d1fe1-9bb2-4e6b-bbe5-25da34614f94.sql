
-- Helper: parse Spanish/European numeric strings to numeric
CREATE OR REPLACE FUNCTION public.parse_es_numeric(t text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  IF t IS NULL THEN RETURN NULL; END IF;
  s := trim(t);
  IF s = '' OR s ~ '^#' THEN RETURN NULL; END IF;
  -- Remove currency, spaces, thousands separators
  s := regexp_replace(s, '[€$\s]', '', 'g');
  -- If both . and , present: assume . = thousands, , = decimal
  IF s ~ '\.' AND s ~ ',' THEN
    s := replace(s, '.', '');
    s := replace(s, ',', '.');
  ELSIF s ~ ',' THEN
    s := replace(s, ',', '.');
  END IF;
  -- Keep only digits, sign, dot
  s := regexp_replace(s, '[^0-9.\-]', '', 'g');
  IF s = '' OR s = '-' OR s = '.' THEN RETURN NULL; END IF;
  BEGIN
    RETURN s::numeric;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$;

ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS comision_total numeric,
  ADD COLUMN IF NOT EXISTS comision_firma numeric,
  ADD COLUMN IF NOT EXISTS comision_apertura numeric,
  ADD COLUMN IF NOT EXISTS honorarios_recibidos text,
  ADD COLUMN IF NOT EXISTS estatus_comercial text,
  ADD COLUMN IF NOT EXISTS cliente_prop text;

UPDATE public.proyectos SET
  comision_total     = public.parse_es_numeric(metadata->>'Total Comisión'),
  comision_firma     = public.parse_es_numeric(metadata->>'Comisión a Firma'),
  comision_apertura  = public.parse_es_numeric(metadata->>'Comisión a Lic/Posesión/Apertura'),
  honorarios_recibidos = NULLIF(trim(metadata->>'Rec. Honor/Contrato Firmados'), ''),
  estatus_comercial  = CASE
      WHEN NULLIF(trim(metadata->>'Estatus'), '') IS NULL THEN NULL
      WHEN lower(trim(metadata->>'Estatus')) = 'caido' THEN 'Caído'
      ELSE trim(metadata->>'Estatus')
    END,
  cliente_prop       = NULLIF(trim(metadata->>'Cliente/Prop.'), '')
WHERE metadata IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_estatus_comision
  ON public.proyectos (estatus_comercial, comision_total DESC NULLS LAST);
