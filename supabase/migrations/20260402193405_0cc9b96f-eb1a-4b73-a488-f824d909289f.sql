
ALTER TABLE public.contactos
  ADD COLUMN IF NOT EXISTS wa_message_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plaud_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_contact timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sentiment text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS interaction_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_favorite boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_network boolean DEFAULT false;

ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS evolution_instance_url text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS evolution_api_key text DEFAULT NULL;
