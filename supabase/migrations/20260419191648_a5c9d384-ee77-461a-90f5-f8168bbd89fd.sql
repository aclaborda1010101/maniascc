-- ABA assistant: conversations and messages (mirrors AVA structure)
CREATE TABLE public.aba_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Nueva conversación',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.aba_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.aba_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_aba_messages_conversation ON public.aba_messages(conversation_id, created_at);
CREATE INDEX idx_aba_conversations_user ON public.aba_conversations(user_id, updated_at DESC);

ALTER TABLE public.aba_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aba_messages ENABLE ROW LEVEL SECURITY;

-- Conversations: owner-only
CREATE POLICY "ABA: users select own conversations"
  ON public.aba_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "ABA: users insert own conversations"
  ON public.aba_conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ABA: users update own conversations"
  ON public.aba_conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "ABA: users delete own conversations"
  ON public.aba_conversations FOR DELETE
  USING (auth.uid() = user_id);

-- Messages: only via owned conversation
CREATE POLICY "ABA: users select own messages"
  ON public.aba_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.aba_conversations c
    WHERE c.id = aba_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "ABA: users insert own messages"
  ON public.aba_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.aba_conversations c
    WHERE c.id = aba_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE POLICY "ABA: users delete own messages"
  ON public.aba_messages FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.aba_conversations c
    WHERE c.id = aba_messages.conversation_id AND c.user_id = auth.uid()
  ));

CREATE TRIGGER trg_aba_conversations_updated_at
  BEFORE UPDATE ON public.aba_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();