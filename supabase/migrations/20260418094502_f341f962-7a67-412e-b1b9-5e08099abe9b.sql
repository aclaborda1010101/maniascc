
-- ==========================================================================
-- 1. TAXONOMÍA DOCUMENTAL
-- ==========================================================================
CREATE TABLE public.documentos_taxonomia (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  parent_id UUID REFERENCES public.documentos_taxonomia(id) ON DELETE SET NULL,
  icono TEXT,
  color TEXT,
  orden INTEGER DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_taxonomia_parent ON public.documentos_taxonomia(parent_id);
CREATE INDEX idx_taxonomia_codigo ON public.documentos_taxonomia(codigo);

ALTER TABLE public.documentos_taxonomia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view taxonomia"
  ON public.documentos_taxonomia FOR SELECT TO authenticated USING (true);

CREATE POLICY "Gestores admins manage taxonomia"
  ON public.documentos_taxonomia FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Seed taxonomía base
INSERT INTO public.documentos_taxonomia (codigo, nombre, descripcion, icono, color, orden) VALUES
  ('activo', 'Activo', 'Documentación de un activo: fichas, planos, fotos, mediciones', 'MapPin', 'chart-1', 10),
  ('operador', 'Operador', 'Dossiers, presentaciones y materiales de marca', 'Building2', 'chart-2', 20),
  ('operacion', 'Operación', 'Negociaciones, ofertas, LOI, term sheets', 'Handshake', 'chart-3', 30),
  ('legal', 'Legal', 'Contratos, escrituras, cláusulas, due diligence', 'Scale', 'destructive', 40),
  ('financiero', 'Financiero', 'Modelos, valoraciones, P&L, cash-flow', 'TrendingUp', 'chart-4', 50),
  ('presentacion', 'Presentación', 'Pitch decks, propuestas comerciales', 'Presentation', 'chart-5', 60),
  ('correo', 'Correo histórico', 'Emails archivados o exportados', 'Mail', 'chart-2', 70),
  ('whatsapp', 'WhatsApp', 'Conversaciones exportadas o sincronizadas', 'MessageCircle', 'chart-1', 80),
  ('plano', 'Plano técnico', 'CAD, PDF de arquitectura, alzados', 'FileText', 'muted', 90),
  ('multimedia', 'Multimedia', 'Fotos, vídeos, renders', 'Image', 'chart-3', 100),
  ('investigacion', 'Investigación', 'Estudios de mercado, benchmarks, normativa', 'Search', 'chart-4', 110),
  ('sin_clasificar', 'Sin clasificar', 'Pendiente de clasificación automática', 'HelpCircle', 'muted', 999);

-- ==========================================================================
-- 2. AMPLIAR documentos_proyecto
-- ==========================================================================
ALTER TABLE public.documentos_proyecto
  ADD COLUMN IF NOT EXISTS taxonomia_id UUID REFERENCES public.documentos_taxonomia(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nombre_normalizado TEXT,
  ADD COLUMN IF NOT EXISTS nivel_sensibilidad TEXT NOT NULL DEFAULT 'interno' CHECK (nivel_sensibilidad IN ('publico','interno','confidencial','restringido')),
  ADD COLUMN IF NOT EXISTS hash_md5 TEXT,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'upload' CHECK (origen IN ('upload','onedrive','email','whatsapp','plaud','api','manual')),
  ADD COLUMN IF NOT EXISTS origen_external_id TEXT,
  ADD COLUMN IF NOT EXISTS fase_rag TEXT NOT NULL DEFAULT 'pending' CHECK (fase_rag IN ('pending','queued','indexed','skipped','error')),
  ADD COLUMN IF NOT EXISTS fecha_documento TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_docs_taxonomia ON public.documentos_proyecto(taxonomia_id);
CREATE INDEX IF NOT EXISTS idx_docs_hash ON public.documentos_proyecto(hash_md5) WHERE hash_md5 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_origen_ext ON public.documentos_proyecto(origen, origen_external_id) WHERE origen_external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_docs_fase ON public.documentos_proyecto(fase_rag);
CREATE INDEX IF NOT EXISTS idx_docs_owner_visibility ON public.documentos_proyecto(owner_id, visibility);

-- ==========================================================================
-- 3. RELACIONES N:M (un documento puede vincularse a varias entidades)
-- ==========================================================================
CREATE TABLE public.document_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES public.documentos_proyecto(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('activo','operador','proyecto','contacto','negociacion','subdivision')),
  entity_id UUID NOT NULL,
  rol TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  UNIQUE (documento_id, entity_type, entity_id)
);

CREATE INDEX idx_doclinks_doc ON public.document_links(documento_id);
CREATE INDEX idx_doclinks_entity ON public.document_links(entity_type, entity_id);

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View document_links if doc is visible"
  ON public.document_links FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.documentos_proyecto d
    WHERE d.id = document_links.documento_id
      AND (d.visibility IN ('shared','global') OR d.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Gestores admins insert document_links"
  ON public.document_links FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Gestores admins delete document_links"
  ON public.document_links FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- ==========================================================================
-- 4. ONEDRIVE SYNC STATE
-- ==========================================================================
CREATE TABLE public.onedrive_sync_state (
  user_id UUID NOT NULL PRIMARY KEY,
  drive_id TEXT,
  root_folder_id TEXT,
  delta_token TEXT,
  estado TEXT NOT NULL DEFAULT 'idle' CHECK (estado IN ('idle','backfill','delta','error','paused')),
  ultimo_backfill TIMESTAMPTZ,
  ultimo_delta TIMESTAMPTZ,
  total_archivos INTEGER NOT NULL DEFAULT 0,
  total_bytes BIGINT NOT NULL DEFAULT 0,
  archivos_indexados INTEGER NOT NULL DEFAULT 0,
  ultimo_error TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.onedrive_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own onedrive sync"
  ON public.onedrive_sync_state FOR ALL TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_onedrive_sync_updated
  BEFORE UPDATE ON public.onedrive_sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================================
-- 5. INGESTION JOBS (cola para procesos masivos)
-- ==========================================================================
CREATE TABLE public.ingestion_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('onedrive_backfill','onedrive_delta','mbox_import','whatsapp_import','manual_upload','rag_reindex')),
  estado TEXT NOT NULL DEFAULT 'pending' CHECK (estado IN ('pending','running','paused','completed','failed','cancelled')),
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  skipped_items INTEGER NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  resumen JSONB NOT NULL DEFAULT '{}'::jsonb,
  ultimo_error TEXT,
  iniciado_en TIMESTAMPTZ,
  completado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_user ON public.ingestion_jobs(user_id, estado);
CREATE INDEX idx_jobs_type ON public.ingestion_jobs(job_type, estado);

ALTER TABLE public.ingestion_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own jobs"
  ON public.ingestion_jobs FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert their own jobs"
  ON public.ingestion_jobs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update their own jobs"
  ON public.ingestion_jobs FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_ingestion_jobs_updated
  BEFORE UPDATE ON public.ingestion_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================================
-- 6. WHATSAPP THREADS (espejo de email_threads para WA)
-- ==========================================================================
CREATE TABLE public.whatsapp_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared' CHECK (visibility IN ('private','shared','global')),
  contact_id UUID,
  contact_name TEXT,
  contact_phone TEXT,
  origen TEXT NOT NULL DEFAULT 'manual' CHECK (origen IN ('manual','export','evolution_api')),
  message_count INTEGER NOT NULL DEFAULT 0,
  first_date TIMESTAMPTZ,
  last_date TIMESTAMPTZ,
  summary TEXT,
  key_topics TEXT[] DEFAULT '{}'::text[],
  sentiment TEXT,
  documento_id UUID REFERENCES public.documentos_proyecto(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_threads_owner ON public.whatsapp_threads(owner_id);
CREATE INDEX idx_wa_threads_contact ON public.whatsapp_threads(contact_id);
CREATE INDEX idx_wa_threads_phone ON public.whatsapp_threads(contact_phone);

ALTER TABLE public.whatsapp_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View whatsapp_threads by visibility or ownership"
  ON public.whatsapp_threads FOR SELECT TO authenticated
  USING (visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores admins insert whatsapp_threads"
  ON public.whatsapp_threads FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Owner or admin update whatsapp_threads"
  ON public.whatsapp_threads FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete whatsapp_threads"
  ON public.whatsapp_threads FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_wa_threads_updated
  BEFORE UPDATE ON public.whatsapp_threads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================================================
-- 7. CAMPOS DE OneDrive en perfiles
-- ==========================================================================
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS onedrive_connected BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onedrive_account TEXT,
  ADD COLUMN IF NOT EXISTS onedrive_root_path TEXT;
