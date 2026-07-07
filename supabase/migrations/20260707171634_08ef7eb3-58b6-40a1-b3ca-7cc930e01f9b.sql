
-- ═══════════════════════════════════════════════════════════════
-- Iteración 2 Clasificador M365: config, bandeja distribuida, doble umbral, aliases
-- ═══════════════════════════════════════════════════════════════

-- A) Config M365 en tabla (single-row) + doble umbral en settings
ALTER TABLE public.email_classifier_settings
  ADD COLUMN IF NOT EXISTS umbral_revision numeric NOT NULL DEFAULT 0.60,
  ADD COLUMN IF NOT EXISTS m365_tenant_id text,
  ADD COLUMN IF NOT EXISTS m365_client_id text,
  ADD COLUMN IF NOT EXISTS m365_client_secret text,
  ADD COLUMN IF NOT EXISTS m365_journal_mailbox text,
  ADD COLUMN IF NOT EXISTS m365_connected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS m365_last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS m365_last_test_result text;

-- Subir default de umbral_auto a 0.85 (para nuevas filas)
ALTER TABLE public.email_classifier_settings
  ALTER COLUMN umbral_auto SET DEFAULT 0.85;

-- Endurecer RLS: solo admin puede leer/escribir la config (contiene secretos)
DROP POLICY IF EXISTS "email_classifier_settings_read" ON public.email_classifier_settings;
DROP POLICY IF EXISTS "email_classifier_settings_admin_read" ON public.email_classifier_settings;
DROP POLICY IF EXISTS "email_classifier_settings_admin_write" ON public.email_classifier_settings;

CREATE POLICY "email_classifier_settings_admin_read"
  ON public.email_classifier_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "email_classifier_settings_admin_write"
  ON public.email_classifier_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- B) Bandeja distribuida: assignment + derivación
ALTER TABLE public.email_ingest_queue
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS derived_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_email_ingest_queue_assigned_to
  ON public.email_ingest_queue(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_email_ingest_queue_status_received
  ON public.email_ingest_queue(status, received_at);

-- RLS: asignado puede ver/actualizar sus items (además de admin/gestor existentes)
DROP POLICY IF EXISTS "email_ingest_queue_assignee_read" ON public.email_ingest_queue;
DROP POLICY IF EXISTS "email_ingest_queue_assignee_update" ON public.email_ingest_queue;

CREATE POLICY "email_ingest_queue_assignee_read"
  ON public.email_ingest_queue FOR SELECT TO authenticated
  USING (assigned_to = auth.uid());

CREATE POLICY "email_ingest_queue_assignee_update"
  ON public.email_ingest_queue FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- C) project_aliases
CREATE TABLE IF NOT EXISTS public.project_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(proyecto_id, alias)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_aliases TO authenticated;
GRANT ALL ON public.project_aliases TO service_role;

ALTER TABLE public.project_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_aliases_read_auth"
  ON public.project_aliases FOR SELECT TO authenticated USING (true);

CREATE POLICY "project_aliases_write_gestor_admin"
  ON public.project_aliases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX IF NOT EXISTS idx_project_aliases_proyecto ON public.project_aliases(proyecto_id);
