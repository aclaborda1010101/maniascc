
-- =============================================
-- ATLAS v2.0 — Tablas para Capas de Inteligencia Avanzada
-- =============================================

-- CAPA 1: Inteligencia de Localización
CREATE TABLE public.patrones_localizacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordenadas_lat NUMERIC NOT NULL,
  coordenadas_lon NUMERIC NOT NULL,
  radio_km NUMERIC DEFAULT 5,
  tipo_centro TEXT DEFAULT 'centro_comercial',
  score_viabilidad NUMERIC DEFAULT 0,
  desglose_variables JSONB DEFAULT '{}'::jsonb,
  riesgos JSONB DEFAULT '[]'::jsonb,
  oportunidades JSONB DEFAULT '[]'::jsonb,
  comparables JSONB DEFAULT '[]'::jsonb,
  fuentes_consultadas JSONB DEFAULT '[]'::jsonb,
  confianza NUMERIC DEFAULT 0,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CAPA 2: Validación de Retornos
CREATE TABLE public.validaciones_retorno (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_storage_path TEXT,
  tipo_activo TEXT DEFAULT 'centro_comercial',
  ubicacion TEXT,
  codigo_postal TEXT,
  metricas_declaradas JSONB NOT NULL DEFAULT '{}'::jsonb,
  metricas_reales JSONB DEFAULT NULL,
  semaforos JSONB DEFAULT '{}'::jsonb,
  desviaciones JSONB DEFAULT '[]'::jsonb,
  benchmarks_usados JSONB DEFAULT '[]'::jsonb,
  confianza_global NUMERIC DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente',
  propietario_ref TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cerrado_en TIMESTAMP WITH TIME ZONE
);

-- CAPA 3: Sinergias entre Operadores
CREATE TABLE public.sinergias_operadores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operador_a_id UUID REFERENCES public.operadores(id) ON DELETE CASCADE,
  operador_b_id UUID REFERENCES public.operadores(id) ON DELETE CASCADE,
  coeficiente_sinergia NUMERIC DEFAULT 0,
  num_observaciones INTEGER DEFAULT 0,
  fuente TEXT DEFAULT 'estimado',
  notas TEXT,
  ultima_actualizacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(operador_a_id, operador_b_id)
);

-- CAPA 3: Configuraciones Tenant Mix
CREATE TABLE public.configuraciones_tenant_mix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_nombre TEXT NOT NULL,
  centro_ubicacion TEXT,
  plan TEXT NOT NULL DEFAULT 'A',
  operadores_recomendados JSONB NOT NULL DEFAULT '[]'::jsonb,
  score_sinergia_total NUMERIC DEFAULT 0,
  prediccion_ocupacion NUMERIC DEFAULT 0,
  renta_estimada_total NUMERIC DEFAULT 0,
  riesgos JSONB DEFAULT '[]'::jsonb,
  estado TEXT DEFAULT 'propuesto',
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CAPA 4: Perfiles de Negociador
CREATE TABLE public.perfiles_negociador (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contacto_nombre TEXT NOT NULL,
  contacto_empresa TEXT,
  contacto_cargo TEXT,
  estilo_primario TEXT DEFAULT 'colaborativo',
  estilo_secundario TEXT,
  puntos_flexion JSONB DEFAULT '[]'::jsonb,
  historico_resumen TEXT,
  preferencias_comunicacion JSONB DEFAULT '{}'::jsonb,
  datos_consentimiento JSONB DEFAULT '{}'::jsonb,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  actualizado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- CAPA 4: Historial de Negociaciones
CREATE TABLE public.negociaciones_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negociador_interno TEXT NOT NULL,
  interlocutor_perfil_id UUID REFERENCES public.perfiles_negociador(id) ON DELETE SET NULL,
  activo_ref TEXT,
  operador_ref TEXT,
  condiciones_iniciales JSONB DEFAULT '{}'::jsonb,
  condiciones_finales JSONB DEFAULT '{}'::jsonb,
  resultado TEXT DEFAULT 'pendiente',
  duracion_dias INTEGER,
  concesiones JSONB DEFAULT '[]'::jsonb,
  probabilidad_cierre_predicha NUMERIC,
  probabilidad_cierre_real NUMERIC,
  notas TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.patrones_localizacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.validaciones_retorno ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinergias_operadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuraciones_tenant_mix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfiles_negociador ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negociaciones_historico ENABLE ROW LEVEL SECURITY;

-- Policies Capas 1-3: acceso autenticados
CREATE POLICY "Authenticated can view patrones_localizacion" ON public.patrones_localizacion FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert patrones_localizacion" ON public.patrones_localizacion FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update patrones_localizacion" ON public.patrones_localizacion FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete patrones_localizacion" ON public.patrones_localizacion FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view validaciones_retorno" ON public.validaciones_retorno FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert validaciones_retorno" ON public.validaciones_retorno FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update validaciones_retorno" ON public.validaciones_retorno FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete validaciones_retorno" ON public.validaciones_retorno FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view sinergias_operadores" ON public.sinergias_operadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert sinergias_operadores" ON public.sinergias_operadores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update sinergias_operadores" ON public.sinergias_operadores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete sinergias_operadores" ON public.sinergias_operadores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view configuraciones_tenant_mix" ON public.configuraciones_tenant_mix FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert configuraciones_tenant_mix" ON public.configuraciones_tenant_mix FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update configuraciones_tenant_mix" ON public.configuraciones_tenant_mix FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete configuraciones_tenant_mix" ON public.configuraciones_tenant_mix FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Policies Capa 4: acceso restringido a admins y gestores
CREATE POLICY "Authenticated can view perfiles_negociador" ON public.perfiles_negociador FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert perfiles_negociador" ON public.perfiles_negociador FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update perfiles_negociador" ON public.perfiles_negociador FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete perfiles_negociador" ON public.perfiles_negociador FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view negociaciones_historico" ON public.negociaciones_historico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores admins can insert negociaciones_historico" ON public.negociaciones_historico FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Gestores admins can update negociaciones_historico" ON public.negociaciones_historico FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Admins can delete negociaciones_historico" ON public.negociaciones_historico FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
