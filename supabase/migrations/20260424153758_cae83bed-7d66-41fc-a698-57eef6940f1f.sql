-- Extend entity_narratives with tags, visibility, and add 2 new tipos (relacion_personal, contexto)

ALTER TABLE public.entity_narratives
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'shared';

-- Drop and re-create tipo CHECK to add the 2 new tipos
ALTER TABLE public.entity_narratives DROP CONSTRAINT IF EXISTS entity_narratives_tipo_check;
ALTER TABLE public.entity_narratives ADD CONSTRAINT entity_narratives_tipo_check
  CHECK (tipo IN (
    'historia',
    'experiencia_buena',
    'experiencia_mala',
    'negociacion',
    'nota',
    'relacion_personal',
    'contexto'
  ));

-- Visibility CHECK
ALTER TABLE public.entity_narratives DROP CONSTRAINT IF EXISTS entity_narratives_visibility_check;
ALTER TABLE public.entity_narratives ADD CONSTRAINT entity_narratives_visibility_check
  CHECK (visibility IN ('shared', 'private'));

-- Update SELECT RLS to respect private narratives (only author or admin can see private)
DROP POLICY IF EXISTS "Authenticated can read narratives" ON public.entity_narratives;
CREATE POLICY "Read narratives by visibility or author"
  ON public.entity_narratives
  FOR SELECT
  TO authenticated
  USING (
    visibility = 'shared'
    OR autor_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Helpful index for tag search
CREATE INDEX IF NOT EXISTS idx_narratives_tags ON public.entity_narratives USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_narratives_visibility ON public.entity_narratives (visibility);