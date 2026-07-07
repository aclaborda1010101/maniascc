
-- 1) email_ingest_queue
CREATE TABLE public.email_ingest_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  graph_message_id text,
  internet_message_id text UNIQUE,
  conversation_id text,
  received_at timestamptz,
  from_email text,
  from_name text,
  to_emails text[] DEFAULT '{}',
  cc_emails text[] DEFAULT '{}',
  subject text,
  body_text text,
  has_attachments boolean DEFAULT false,
  attachments jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','needs_review','applied','discarded','error')),
  classification jsonb DEFAULT '{}'::jsonb,
  applied_at timestamptz,
  error_msg text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_eiq_status ON public.email_ingest_queue(status);
CREATE INDEX idx_eiq_conversation ON public.email_ingest_queue(conversation_id);
CREATE INDEX idx_eiq_received ON public.email_ingest_queue(received_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_ingest_queue TO authenticated;
GRANT ALL ON public.email_ingest_queue TO service_role;
ALTER TABLE public.email_ingest_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/gestores select email_ingest_queue"
  ON public.email_ingest_queue FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Admins/gestores update email_ingest_queue"
  ON public.email_ingest_queue FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- 2) email_classifier_settings (singleton)
CREATE TABLE public.email_classifier_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  umbral_auto numeric NOT NULL DEFAULT 0.80 CHECK (umbral_auto >= 0 AND umbral_auto <= 1),
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.email_classifier_settings TO authenticated;
GRANT ALL ON public.email_classifier_settings TO service_role;
ALTER TABLE public.email_classifier_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read settings" ON public.email_classifier_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Admins update settings" ON public.email_classifier_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.email_classifier_settings (umbral_auto, activo) VALUES (0.80, true);

-- 3) Extend contact_messages.channel to allow 'email_journal'
ALTER TABLE public.contact_messages DROP CONSTRAINT contact_messages_channel_check;
ALTER TABLE public.contact_messages ADD CONSTRAINT contact_messages_channel_check
  CHECK (channel = ANY (ARRAY['email_outlook','email_gmail','email_journal','whatsapp','manual']));

-- 4) Extend documentos_proyecto.origen to allow 'email_journal'
ALTER TABLE public.documentos_proyecto DROP CONSTRAINT documentos_proyecto_origen_check;
ALTER TABLE public.documentos_proyecto ADD CONSTRAINT documentos_proyecto_origen_check
  CHECK (origen = ANY (ARRAY['upload','onedrive','email','email_journal','whatsapp','plaud','api','manual']));
