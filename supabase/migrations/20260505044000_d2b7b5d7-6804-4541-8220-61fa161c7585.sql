CREATE TABLE public.ava_user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key text NOT NULL,
  value text NOT NULL,
  category text,
  source text NOT NULL DEFAULT 'user_explicit'
    CHECK (source IN ('user_explicit', 'ai_inferred')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX idx_ava_user_memory_user_recent
  ON public.ava_user_memory (user_id, last_used_at DESC);

CREATE TRIGGER trg_ava_user_memory_updated_at
  BEFORE UPDATE ON public.ava_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.ava_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ava_memory_select_own"
  ON public.ava_user_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "ava_memory_insert_own"
  ON public.ava_user_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ava_memory_update_own"
  ON public.ava_user_memory FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ava_memory_delete_own"
  ON public.ava_user_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);