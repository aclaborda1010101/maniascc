
-- 1) Añadir flag requires_conversation_context a golden_questions y marcar N3
ALTER TABLE public.golden_questions
  ADD COLUMN IF NOT EXISTS requires_conversation_context boolean NOT NULL DEFAULT false;

UPDATE public.golden_questions
   SET requires_conversation_context = true
 WHERE upper(coalesce(code,'')) = 'N3';

-- 2) Quitar rol admin al usuario de pruebas (harness ya acepta service-role)
DELETE FROM public.user_roles
 WHERE role = 'admin'
   AND user_id IN (SELECT id FROM auth.users WHERE email = 'admin@atlas.fg');

-- 3) Marcar la corrida vieja como no fiable (sin cambiar run_type para no violar CHECK)
UPDATE public.golden_runs
   SET notes = coalesce(notes,'') || ' | harness pre-fix, no fiable'
 WHERE run_name = 'baseline_partial_pre_dedup_v1';
