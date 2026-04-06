
CREATE TABLE public.subdivision_activos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdivision_id uuid NOT NULL REFERENCES public.operador_subdivisiones(id) ON DELETE CASCADE,
  activo_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subdivision_id, activo_id)
);

ALTER TABLE public.subdivision_activos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view subdivision_activos"
  ON public.subdivision_activos FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Gestores admins can insert subdivision_activos"
  ON public.subdivision_activos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can delete subdivision_activos"
  ON public.subdivision_activos FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));
