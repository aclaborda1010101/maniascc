
-- Tabla de Farmacias (Proyecto Fase 1)
CREATE TABLE public.farmacias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  codigo_postal TEXT NOT NULL DEFAULT '',
  riesgo_desabastecimiento TEXT CHECK (riesgo_desabastecimiento IN ('alto','medio','bajo')),
  score_riesgo NUMERIC DEFAULT 0,
  datos_revelados BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.farmacias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view farmacias"
  ON public.farmacias FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores and admins can insert farmacias"
  ON public.farmacias FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores and admins can update farmacias"
  ON public.farmacias FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete farmacias"
  ON public.farmacias FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_farmacias_updated_at
  BEFORE UPDATE ON public.farmacias
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
