
-- =============================================
-- ATLAS v3.1 — Schema alignment with spec
-- =============================================

-- 1. Add new tipo_proyecto enum values
ALTER TYPE public.tipo_proyecto ADD VALUE IF NOT EXISTS 'auditoria_estrategica';
ALTER TYPE public.tipo_proyecto ADD VALUE IF NOT EXISTS 'desarrollo_suelo';
ALTER TYPE public.tipo_proyecto ADD VALUE IF NOT EXISTS 'traspaso_adquisicion';
ALTER TYPE public.tipo_proyecto ADD VALUE IF NOT EXISTS 'farmacia';

-- 2. Add new estado_proyecto enum values
ALTER TYPE public.estado_proyecto ADD VALUE IF NOT EXISTS 'en_negociacion';
ALTER TYPE public.estado_proyecto ADD VALUE IF NOT EXISTS 'archivado';

-- 3. Create contactos table (dedicated contacts directory)
CREATE TABLE IF NOT EXISTS public.contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  apellidos TEXT,
  empresa TEXT,
  cargo TEXT,
  email TEXT,
  telefono TEXT,
  linkedin_url TEXT,
  estilo_negociacion TEXT CHECK (estilo_negociacion IN (
    'competitivo', 'colaborativo', 'analitico', 'expresivo', 'evitador'
  )),
  notas_perfil TEXT,
  perfil_ia JSONB DEFAULT '{}'::jsonb,
  datos_consentimiento JSONB DEFAULT '{}'::jsonb,
  creado_por UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contactos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contactos" ON public.contactos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert contactos" ON public.contactos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can update contactos" ON public.contactos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete contactos" ON public.contactos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Add missing columns to proyectos
ALTER TABLE public.proyectos 
  ADD COLUMN IF NOT EXISTS ubicacion TEXT,
  ADD COLUMN IF NOT EXISTS codigo_postal TEXT,
  ADD COLUMN IF NOT EXISTS presupuesto_estimado NUMERIC,
  ADD COLUMN IF NOT EXISTS cliente_contacto_id UUID REFERENCES public.contactos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 5. Create activos table (project-linked assets)
CREATE TABLE IF NOT EXISTS public.activos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_activo TEXT CHECK (tipo_activo IN (
    'local_comercial', 'centro_comercial', 'parque_medianas',
    'high_street', 'nave', 'suelo', 'edificio_retail'
  )),
  direccion TEXT,
  codigo_postal TEXT,
  metros_cuadrados NUMERIC,
  planta TEXT,
  fachada_metros NUMERIC,
  renta_actual NUMERIC,
  renta_esperada NUMERIC,
  gastos_comunidad NUMERIC,
  estado TEXT DEFAULT 'disponible' CHECK (estado IN (
    'disponible', 'en_negociacion', 'reservado', 'alquilado', 'vendido'
  )),
  caracteristicas JSONB DEFAULT '{}'::jsonb,
  fotos_urls JSONB DEFAULT '[]'::jsonb,
  coordenadas_lat NUMERIC,
  coordenadas_lon NUMERIC,
  notas TEXT,
  creado_por UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.activos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view activos" ON public.activos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert activos" ON public.activos
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can update activos" ON public.activos
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete activos" ON public.activos
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_activos_proyecto ON public.activos(proyecto_id);

-- 6. Create negociaciones table
CREATE TABLE IF NOT EXISTS public.negociaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  activo_id UUID REFERENCES public.activos(id) ON DELETE SET NULL,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  contacto_interlocutor_id UUID REFERENCES public.contactos(id) ON DELETE SET NULL,
  negociador_interno_id UUID,
  estado TEXT DEFAULT 'preparacion' CHECK (estado IN (
    'preparacion', 'contacto_inicial', 'propuesta_enviada',
    'en_negociacion', 'contraoferta', 'acuerdo_verbal',
    'contrato_enviado', 'firmado', 'rechazado', 'cancelado'
  )),
  condiciones_propuestas JSONB DEFAULT '{}'::jsonb,
  condiciones_actuales JSONB DEFAULT '{}'::jsonb,
  condiciones_finales JSONB DEFAULT '{}'::jsonb,
  probabilidad_cierre NUMERIC CHECK (probabilidad_cierre >= 0 AND probabilidad_cierre <= 100),
  briefing_ia TEXT,
  fecha_ultimo_contacto DATE,
  fecha_cierre DATE,
  resultado TEXT CHECK (resultado IN ('exito', 'fracaso')),
  motivo_resultado TEXT,
  notas TEXT,
  creado_por UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.negociaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view negociaciones" ON public.negociaciones
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert negociaciones" ON public.negociaciones
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can update negociaciones" ON public.negociaciones
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete negociaciones" ON public.negociaciones
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_negociaciones_proyecto ON public.negociaciones(proyecto_id);

-- 7. Create proyecto_equipo table
CREATE TABLE IF NOT EXISTS public.proyecto_equipo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL,
  rol_proyecto TEXT DEFAULT 'miembro' CHECK (rol_proyecto IN ('lider', 'miembro', 'observador')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(proyecto_id, usuario_id)
);

ALTER TABLE public.proyecto_equipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view proyecto_equipo" ON public.proyecto_equipo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert proyecto_equipo" ON public.proyecto_equipo
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can delete proyecto_equipo" ON public.proyecto_equipo
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 8. Create actividad_proyecto table (project activity timeline)
CREATE TABLE IF NOT EXISTS public.actividad_proyecto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  usuario_id UUID,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'creacion', 'estado_cambiado', 'activo_anadido', 'operador_vinculado',
    'match_generado', 'match_aprobado', 'match_rechazado',
    'documento_subido', 'validacion_ejecutada',
    'negociacion_creada', 'negociacion_actualizada',
    'patron_analizado', 'nota_anadida', 'equipo_cambiado'
  )),
  descripcion TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.actividad_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view actividad_proyecto" ON public.actividad_proyecto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert actividad_proyecto" ON public.actividad_proyecto
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE INDEX IF NOT EXISTS idx_actividad_proyecto ON public.actividad_proyecto(proyecto_id);

-- 9. Create documentos table (project-linked documents, per spec)
CREATE TABLE IF NOT EXISTS public.documentos_proyecto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES public.proyectos(id) ON DELETE CASCADE,
  operador_id UUID REFERENCES public.operadores(id) ON DELETE SET NULL,
  contacto_id UUID REFERENCES public.contactos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  tipo_documento TEXT CHECK (tipo_documento IN (
    'contrato', 'dossier', 'propuesta_comercial', 'email',
    'acta_reunion', 'informe', 'factura', 'plano', 'foto', 'otro'
  )),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamano_bytes INTEGER,
  procesado_ia BOOLEAN DEFAULT FALSE,
  resumen_ia TEXT,
  metadata_extraida JSONB DEFAULT '{}'::jsonb,
  subido_por UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.documentos_proyecto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view documentos_proyecto" ON public.documentos_proyecto
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins can insert documentos_proyecto" ON public.documentos_proyecto
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins can update documentos_proyecto" ON public.documentos_proyecto
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Admins can delete documentos_proyecto" ON public.documentos_proyecto
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_documentos_proyecto ON public.documentos_proyecto(proyecto_id);
