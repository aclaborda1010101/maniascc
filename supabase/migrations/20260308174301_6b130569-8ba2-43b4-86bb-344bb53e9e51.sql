
-- Fix overly permissive INSERT policy on auditoria_ia
DROP POLICY "System can insert auditoria" ON public.auditoria_ia;
CREATE POLICY "Authenticated users can insert their own auditoria" ON public.auditoria_ia 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = created_by);
