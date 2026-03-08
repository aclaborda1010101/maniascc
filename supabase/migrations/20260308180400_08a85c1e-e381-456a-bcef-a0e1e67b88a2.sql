
-- Add feedback_usuario to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS feedback_usuario TEXT CHECK (feedback_usuario IN ('positivo','negativo'));

-- Update estado_match enum to include 'sugerido','contactado','exito'
-- We need to add the missing values to the enum
ALTER TYPE public.estado_match ADD VALUE IF NOT EXISTS 'sugerido';
ALTER TYPE public.estado_match ADD VALUE IF NOT EXISTS 'contactado';
ALTER TYPE public.estado_match ADD VALUE IF NOT EXISTS 'exito';

-- Add funcion_ia to auditoria_ia for tracking which AI function was called
ALTER TABLE public.auditoria_ia ADD COLUMN IF NOT EXISTS funcion_ia TEXT DEFAULT 'matching';

-- Add usuario_id reference to auditoria_ia (maps to created_by but explicit)
-- created_by already exists, so no change needed there
