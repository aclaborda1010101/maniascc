
-- Enum for project types
CREATE TYPE public.tipo_proyecto AS ENUM ('comercializacion', 'negociacion', 'centro_completo', 'otro');

-- Enum for project status
CREATE TYPE public.estado_proyecto AS ENUM ('borrador', 'activo', 'en_pausa', 'cerrado_exito', 'cerrado_sin_exito');

-- Main projects table
CREATE TABLE public.proyectos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  tipo tipo_proyecto NOT NULL DEFAULT 'comercializacion',
  estado estado_proyecto NOT NULL DEFAULT 'borrador',
  local_id uuid REFERENCES public.locales(id) ON DELETE SET NULL,
  created_by uuid,
  responsable_id uuid,
  fecha_inicio date DEFAULT CURRENT_DATE,
  fecha_objetivo date,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Junction table: projects can have multiple operators
CREATE TABLE public.proyecto_operadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  operador_id uuid NOT NULL REFERENCES public.operadores(id) ON DELETE CASCADE,
  rol text DEFAULT 'candidato',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, operador_id)
);

-- Junction table: projects can have multiple contacts
CREATE TABLE public.proyecto_contactos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  contacto_id uuid NOT NULL REFERENCES public.perfiles_negociador(id) ON DELETE CASCADE,
  rol text DEFAULT 'interlocutor',
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, contacto_id)
);

-- Enable RLS
ALTER TABLE public.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proyecto_contactos ENABLE ROW LEVEL SECURITY;

-- RLS policies for proyectos
CREATE POLICY "Authenticated can view proyectos" ON public.proyectos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert proyectos" ON public.proyectos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores admins can update proyectos" ON public.proyectos FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Admins can delete proyectos" ON public.proyectos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'));

-- RLS for proyecto_operadores
CREATE POLICY "Authenticated can view proyecto_operadores" ON public.proyecto_operadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert proyecto_operadores" ON public.proyecto_operadores FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores admins can delete proyecto_operadores" ON public.proyecto_operadores FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- RLS for proyecto_contactos
CREATE POLICY "Authenticated can view proyecto_contactos" ON public.proyecto_contactos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert proyecto_contactos" ON public.proyecto_contactos FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores admins can delete proyecto_contactos" ON public.proyecto_contactos FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

-- Updated_at trigger for proyectos
CREATE TRIGGER set_updated_at_proyectos BEFORE UPDATE ON public.proyectos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
