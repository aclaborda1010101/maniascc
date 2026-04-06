
CREATE TABLE public.ava_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ava_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ava_conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ava_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ava_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations" ON public.ava_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.ava_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.ava_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.ava_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can view own messages" ON public.ava_messages FOR SELECT TO authenticated USING (conversation_id IN (SELECT id FROM public.ava_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.ava_messages FOR INSERT TO authenticated WITH CHECK (conversation_id IN (SELECT id FROM public.ava_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own messages" ON public.ava_messages FOR DELETE TO authenticated USING (conversation_id IN (SELECT id FROM public.ava_conversations WHERE user_id = auth.uid()));

CREATE INDEX idx_ava_conversations_user ON public.ava_conversations(user_id);
CREATE INDEX idx_ava_messages_conv ON public.ava_messages(conversation_id);
