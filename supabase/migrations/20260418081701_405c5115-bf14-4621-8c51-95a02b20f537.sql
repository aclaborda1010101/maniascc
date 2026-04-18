-- email_threads: hilos agregados (resumen IA, no contenido literal)
CREATE TABLE public.email_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared',
  thread_external_id TEXT,
  subject TEXT,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  first_date TIMESTAMP WITH TIME ZONE,
  last_date TIMESTAMP WITH TIME ZONE,
  message_count INTEGER NOT NULL DEFAULT 1,
  summary TEXT,
  key_topics TEXT[] DEFAULT '{}',
  sentiment TEXT,
  documento_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_threads_owner ON public.email_threads(owner_id);
CREATE INDEX idx_email_threads_visibility ON public.email_threads(visibility);
CREATE INDEX idx_email_threads_last_date ON public.email_threads(last_date DESC);
CREATE INDEX idx_email_threads_subject_fts ON public.email_threads USING GIN (to_tsvector('spanish', coalesce(subject,'') || ' ' || coalesce(summary,'')));

ALTER TABLE public.email_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View email_threads by visibility or ownership"
ON public.email_threads FOR SELECT TO authenticated
USING (visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores admins insert email_threads"
ON public.email_threads FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Owner or admin update email_threads"
ON public.email_threads FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete email_threads"
ON public.email_threads FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_email_threads_updated_at
BEFORE UPDATE ON public.email_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- email_entities: entidades detectadas en cada hilo
CREATE TABLE public.email_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared',
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name_raw TEXT NOT NULL,
  mention_count INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  context_snippet TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_entities_thread ON public.email_entities(thread_id);
CREATE INDEX idx_email_entities_type_name ON public.email_entities(entity_type, entity_name_raw);
CREATE INDEX idx_email_entities_entity_id ON public.email_entities(entity_id) WHERE entity_id IS NOT NULL;
CREATE INDEX idx_email_entities_owner ON public.email_entities(owner_id);

ALTER TABLE public.email_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View email_entities by visibility or ownership"
ON public.email_entities FOR SELECT TO authenticated
USING (visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores admins insert email_entities"
ON public.email_entities FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Owner or admin update email_entities"
ON public.email_entities FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete email_entities"
ON public.email_entities FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- negotiation_signals: señales de negociación detectadas
CREATE TABLE public.negotiation_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.email_threads(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared',
  signal_type TEXT NOT NULL,
  signal_value TEXT,
  numeric_value NUMERIC,
  unit TEXT,
  context_snippet TEXT,
  related_entity_id UUID,
  related_entity_type TEXT,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  extracted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_neg_signals_thread ON public.negotiation_signals(thread_id);
CREATE INDEX idx_neg_signals_type ON public.negotiation_signals(signal_type);
CREATE INDEX idx_neg_signals_entity ON public.negotiation_signals(related_entity_type, related_entity_id);
CREATE INDEX idx_neg_signals_owner ON public.negotiation_signals(owner_id);

ALTER TABLE public.negotiation_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View negotiation_signals by visibility or ownership"
ON public.negotiation_signals FOR SELECT TO authenticated
USING (visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores admins insert negotiation_signals"
ON public.negotiation_signals FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Owner or admin update negotiation_signals"
ON public.negotiation_signals FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete negotiation_signals"
ON public.negotiation_signals FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- contact_interactions: estadísticas agregadas por contacto externo
CREATE TABLE public.contact_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'shared',
  contact_email TEXT NOT NULL,
  contact_name TEXT,
  contact_id UUID,
  thread_count INTEGER NOT NULL DEFAULT 0,
  message_count INTEGER NOT NULL DEFAULT 0,
  first_interaction TIMESTAMP WITH TIME ZONE,
  last_interaction TIMESTAMP WITH TIME ZONE,
  sentiment_avg NUMERIC,
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (owner_id, contact_email)
);

CREATE INDEX idx_contact_interactions_email ON public.contact_interactions(lower(contact_email));
CREATE INDEX idx_contact_interactions_contact_id ON public.contact_interactions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_contact_interactions_owner ON public.contact_interactions(owner_id);
CREATE INDEX idx_contact_interactions_last ON public.contact_interactions(last_interaction DESC);

ALTER TABLE public.contact_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View contact_interactions by visibility or ownership"
ON public.contact_interactions FOR SELECT TO authenticated
USING (visibility IN ('shared','global') OR owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestores admins insert contact_interactions"
ON public.contact_interactions FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Owner or admin update contact_interactions"
ON public.contact_interactions FOR UPDATE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin delete contact_interactions"
ON public.contact_interactions FOR DELETE TO authenticated
USING (owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_contact_interactions_updated_at
BEFORE UPDATE ON public.contact_interactions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();