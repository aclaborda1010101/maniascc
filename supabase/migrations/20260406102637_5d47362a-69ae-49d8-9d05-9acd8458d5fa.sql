ALTER TABLE public.operadores ADD COLUMN IF NOT EXISTS direccion text;
ALTER TABLE public.operadores ADD COLUMN IF NOT EXISTS activo_id uuid REFERENCES public.locales(id) ON DELETE SET NULL;