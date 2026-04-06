
-- 1. Create operador_subdivisiones table
CREATE TABLE public.operador_subdivisiones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_id uuid NOT NULL REFERENCES public.operadores(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  descripcion text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.operador_subdivisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view operador_subdivisiones"
  ON public.operador_subdivisiones FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Gestores admins can insert operador_subdivisiones"
  ON public.operador_subdivisiones FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can update operador_subdivisiones"
  ON public.operador_subdivisiones FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can delete operador_subdivisiones"
  ON public.operador_subdivisiones FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 2. Add columns to contactos
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS subdivision_id uuid REFERENCES public.operador_subdivisiones(id) ON DELETE SET NULL;
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS activo_id uuid;
