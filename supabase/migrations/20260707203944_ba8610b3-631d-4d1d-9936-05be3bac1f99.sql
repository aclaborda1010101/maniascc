
-- 1) Función de normalización robusta de nombres de proyecto
CREATE OR REPLACE FUNCTION public.normalize_project_key(p_text text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s text;
BEGIN
  IF p_text IS NULL THEN RETURN NULL; END IF;
  s := lower(btrim(p_text));

  -- Quitar acentos (translate cubre lo habitual en ES sin depender de unaccent)
  s := translate(s,
    'áàäâãåéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÅÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
    'aaaaaaeeeeiiiiooooouuuuncAAAAAAEEEEIIIIOOOOOUUUUNC'
  );

  -- Normalizar guiones largos/medios/normales
  s := regexp_replace(s, '[—–−-]', '-', 'g');

  -- Puntuación blanda fuera
  s := regexp_replace(s, '[.,;:''"`]', ' ', 'g');

  -- Normalizar prefijos comunes
  s := regexp_replace(s, '\m(centro comercial)\M', 'cc', 'g');
  s := regexp_replace(s, '\mc\s*c\M', 'cc', 'g');           -- "c c" -> cc
  s := regexp_replace(s, '\mavenida\M', 'av', 'g');
  s := regexp_replace(s, '\mav\M', 'av', 'g');
  s := regexp_replace(s, '\mcalle\M', 'calle', 'g');
  s := regexp_replace(s, '\mc\s*/', 'calle ', 'g');         -- "c/" -> "calle "

  -- Colapsar espacios y espacios alrededor de guiones
  s := regexp_replace(s, '\s*-\s*', '-', 'g');
  s := regexp_replace(s, '\s+', ' ', 'g');
  s := btrim(s);

  RETURN s;
END;
$$;

-- 2) Columna dedup_status en proyectos
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS dedup_status text NOT NULL DEFAULT 'sin_revisar';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_dedup_status_chk'
  ) THEN
    ALTER TABLE public.proyectos
      ADD CONSTRAINT proyectos_dedup_status_chk
      CHECK (dedup_status IN ('sin_revisar','duplicate_candidate','confirmed_duplicate','not_duplicate'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proyectos_dedup_status ON public.proyectos(dedup_status);
CREATE INDEX IF NOT EXISTS idx_proyectos_norm_key ON public.proyectos(normalize_project_key(nombre));
