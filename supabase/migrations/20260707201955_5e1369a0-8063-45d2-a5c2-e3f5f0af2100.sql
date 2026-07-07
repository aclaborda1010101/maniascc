
ALTER TABLE public.proyectos
  ADD COLUMN IF NOT EXISTS canonical_project_id uuid NULL REFERENCES public.proyectos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS merge_status text NOT NULL DEFAULT 'activo';

ALTER TABLE public.proyectos
  DROP CONSTRAINT IF EXISTS proyectos_merge_status_check;
ALTER TABLE public.proyectos
  ADD CONSTRAINT proyectos_merge_status_check CHECK (merge_status IN ('activo','fusionado'));

CREATE INDEX IF NOT EXISTS idx_proyectos_merge_status ON public.proyectos(merge_status);
CREATE INDEX IF NOT EXISTS idx_proyectos_canonical ON public.proyectos(canonical_project_id);
