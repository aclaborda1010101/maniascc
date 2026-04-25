-- ===== contact_messages =====
CREATE TABLE public.contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contactos(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email_outlook','email_gmail','whatsapp','manual')),
  external_id TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('in','out')),
  from_email TEXT,
  from_name TEXT,
  to_emails TEXT[] DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_snippet TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  thread_external_id TEXT,
  sentiment TEXT CHECK (sentiment IN ('good','neutral','bad')),
  processed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contact_messages_external ON public.contact_messages (owner_id, channel, external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_contact_messages_contact_sent ON public.contact_messages (contact_id, sent_at DESC);
CREATE INDEX idx_contact_messages_owner_sent ON public.contact_messages (owner_id, sent_at DESC);
CREATE INDEX idx_contact_messages_unprocessed ON public.contact_messages (contact_id) WHERE processed_at IS NULL;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own messages" ON public.contact_messages FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts own messages" ON public.contact_messages FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner updates own messages" ON public.contact_messages FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner deletes own messages" ON public.contact_messages FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ===== contact_tasks =====
CREATE TABLE public.contact_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID REFERENCES public.contactos(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('ai_email','ai_wa','ai_other','manual')),
  source_message_id UUID REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','snoozed','cancelled')),
  priority INT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_tasks_contact ON public.contact_tasks (contact_id, status, due_at);
CREATE INDEX idx_contact_tasks_owner_pending ON public.contact_tasks (owner_id, due_at) WHERE status = 'pending';

ALTER TABLE public.contact_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own tasks" ON public.contact_tasks FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts own tasks" ON public.contact_tasks FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner updates own tasks" ON public.contact_tasks FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner deletes own tasks" ON public.contact_tasks FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_contact_tasks_updated_at BEFORE UPDATE ON public.contact_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== contact_milestones =====
CREATE TABLE public.contact_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  event_at TIMESTAMPTZ NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('positivo','tension','acuerdo','incidencia','hito','reunion','primer_contacto')),
  score TEXT NOT NULL DEFAULT 'neutral' CHECK (score IN ('good','neutral','bad')),
  title TEXT NOT NULL,
  description TEXT,
  source_message_id UUID REFERENCES public.contact_messages(id) ON DELETE SET NULL,
  auto_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_milestones_contact_event ON public.contact_milestones (contact_id, event_at DESC);

ALTER TABLE public.contact_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own milestones" ON public.contact_milestones FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts own milestones" ON public.contact_milestones FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner updates own milestones" ON public.contact_milestones FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner deletes own milestones" ON public.contact_milestones FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ===== contact_links =====
CREATE TABLE public.contact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_a UUID NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  contact_b UUID NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'menciona' CHECK (tipo IN ('familiar','empresa','menciona','mismo_grupo','partner','referido')),
  notas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (contact_a <> contact_b)
);

-- par único independiente del orden
CREATE UNIQUE INDEX idx_contact_links_pair ON public.contact_links (
  owner_id,
  LEAST(contact_a, contact_b),
  GREATEST(contact_a, contact_b)
);

ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own links" ON public.contact_links FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts own links" ON public.contact_links FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner deletes own links" ON public.contact_links FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ===== contact_alerts =====
CREATE TABLE public.contact_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  contact_id UUID NOT NULL REFERENCES public.contactos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('inactividad','oportunidad','riesgo','compromiso_pendiente','seguimiento')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','high')),
  mensaje TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  dismissed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_alerts_contact ON public.contact_alerts (contact_id, dismissed_at, created_at DESC);
CREATE INDEX idx_contact_alerts_owner_active ON public.contact_alerts (owner_id, severity, created_at DESC) WHERE dismissed_at IS NULL;

ALTER TABLE public.contact_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own alerts" ON public.contact_alerts FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner inserts own alerts" ON public.contact_alerts FOR INSERT
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner updates own alerts" ON public.contact_alerts FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner deletes own alerts" ON public.contact_alerts FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ===== sync_state =====
CREATE TABLE public.sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  channel TEXT NOT NULL,
  cursor TEXT,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, channel)
);

ALTER TABLE public.sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner sees own sync" ON public.sync_state FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "owner upserts own sync" ON public.sync_state FOR ALL
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_sync_state_updated_at BEFORE UPDATE ON public.sync_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();