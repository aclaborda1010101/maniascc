
-- ===========================================
-- ATLAS Fase 0: Complete Database Schema
-- ===========================================

-- 1. Enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'inversor');

-- 2. Enum for local status
CREATE TYPE public.estado_local AS ENUM ('disponible', 'en_negociacion', 'ocupado', 'reforma');

-- 3. Enum for match status
CREATE TYPE public.estado_match AS ENUM ('pendiente', 'aprobado', 'descartado');

-- 4. Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ===========================================
-- PROFILES TABLE
-- ===========================================
CREATE TABLE public.perfiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL DEFAULT '',
  apellidos TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefono TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.perfiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.perfiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON public.perfiles FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_perfiles_updated_at BEFORE UPDATE ON public.perfiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfiles (user_id, email, nombre)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'nombre', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================================
-- USER ROLES TABLE (separate from profiles!)
-- ===========================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'gestor' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'gestor');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- ===========================================
-- LOCALES TABLE
-- ===========================================
CREATE TABLE public.locales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT NOT NULL,
  codigo_postal TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT '',
  superficie_m2 NUMERIC NOT NULL DEFAULT 0,
  precio_renta NUMERIC NOT NULL DEFAULT 0,
  estado estado_local NOT NULL DEFAULT 'disponible',
  descripcion TEXT,
  caracteristicas JSONB DEFAULT '{}',
  coordenadas_lat NUMERIC,
  coordenadas_lng NUMERIC,
  imagen_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view locales" ON public.locales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores and admins can insert locales" ON public.locales FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores and admins can update locales" ON public.locales FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Admins can delete locales" ON public.locales FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_locales_updated_at BEFORE UPDATE ON public.locales FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- OPERADORES TABLE
-- ===========================================
CREATE TABLE public.operadores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  sector TEXT NOT NULL DEFAULT '',
  presupuesto_min NUMERIC NOT NULL DEFAULT 0,
  presupuesto_max NUMERIC NOT NULL DEFAULT 0,
  superficie_min NUMERIC NOT NULL DEFAULT 0,
  superficie_max NUMERIC NOT NULL DEFAULT 0,
  descripcion TEXT,
  contacto_nombre TEXT,
  contacto_email TEXT,
  contacto_telefono TEXT,
  perfil_ia TEXT,
  logo_url TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.operadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view operadores" ON public.operadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores and admins can insert operadores" ON public.operadores FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores and admins can update operadores" ON public.operadores FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Admins can delete operadores" ON public.operadores FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_operadores_updated_at BEFORE UPDATE ON public.operadores FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- MATCHES TABLE
-- ===========================================
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  local_id UUID NOT NULL REFERENCES public.locales(id) ON DELETE CASCADE,
  operador_id UUID NOT NULL REFERENCES public.operadores(id) ON DELETE CASCADE,
  score NUMERIC NOT NULL DEFAULT 0,
  explicacion TEXT,
  tags TEXT[] DEFAULT '{}',
  estado estado_match NOT NULL DEFAULT 'pendiente',
  generado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view matches" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Gestores and admins can insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Gestores and admins can update matches" ON public.matches FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE POLICY "Admins can delete matches" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===========================================
-- AUDITORIA IA TABLE
-- ===========================================
CREATE TABLE public.auditoria_ia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  local_id UUID REFERENCES public.locales(id) ON DELETE SET NULL,
  modelo TEXT NOT NULL DEFAULT 'rule-based',
  tokens_entrada INTEGER DEFAULT 0,
  tokens_salida INTEGER DEFAULT 0,
  coste_estimado NUMERIC DEFAULT 0,
  latencia_ms INTEGER DEFAULT 0,
  exito BOOLEAN NOT NULL DEFAULT true,
  error_mensaje TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.auditoria_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view auditoria" ON public.auditoria_ia FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert auditoria" ON public.auditoria_ia FOR INSERT TO authenticated WITH CHECK (true);

-- ===========================================
-- STORAGE BUCKETS
-- ===========================================
INSERT INTO storage.buckets (id, name, public) VALUES ('multimedia_locales', 'multimedia_locales', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('documentos_contratos', 'documentos_contratos', false);

-- Public bucket policies
CREATE POLICY "Anyone can view multimedia_locales" ON storage.objects FOR SELECT USING (bucket_id = 'multimedia_locales');
CREATE POLICY "Authenticated users can upload to multimedia_locales" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'multimedia_locales');
CREATE POLICY "Authenticated users can update multimedia_locales" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'multimedia_locales');

-- Private bucket policies
CREATE POLICY "Authenticated users can view documentos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documentos_contratos');
CREATE POLICY "Authenticated users can upload documentos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documentos_contratos');
