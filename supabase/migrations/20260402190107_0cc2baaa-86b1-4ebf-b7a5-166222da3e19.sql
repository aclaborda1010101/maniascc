
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT NULL;
ALTER TABLE public.contactos ADD COLUMN IF NOT EXISTS operador_id uuid DEFAULT NULL REFERENCES public.operadores(id) ON DELETE SET NULL;
