
-- ============================================================================
-- SECURITY FIXES
-- ============================================================================

-- 1) Restrict SELECT on AI/intelligence tables to authenticated users only
--    (was {public} with USING true, allowing anonymous reads)

DROP POLICY IF EXISTS "Authenticated can view tasks" ON public.ai_agent_tasks;
CREATE POLICY "Authenticated can view tasks"
  ON public.ai_agent_tasks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can view insights" ON public.ai_insights;
CREATE POLICY "Authenticated can view insights"
  ON public.ai_insights FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can view feedback" ON public.ai_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.ai_feedback FOR SELECT
  TO authenticated
  USING (auth.uid() = usuario_id OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated can view patterns" ON public.ai_learned_patterns;
CREATE POLICY "Authenticated can view patterns"
  ON public.ai_learned_patterns FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can view predictions" ON public.match_predictions;
CREATE POLICY "Authenticated can view predictions"
  ON public.match_predictions FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can view embeddings" ON public.document_embeddings;
CREATE POLICY "Authenticated can view embeddings"
  ON public.document_embeddings FOR SELECT
  TO authenticated
  USING (true);

-- 2) auditoria_ia: restrict reads to owner + admin (was visible to ALL authenticated users)

DROP POLICY IF EXISTS "Authenticated users can view auditoria" ON public.auditoria_ia;

CREATE POLICY "Users view own auditoria"
  ON public.auditoria_ia FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Admins view all auditoria"
  ON public.auditoria_ia FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3) Storage: documentos_contratos — replace permissive policies with owner-scoped ones

DROP POLICY IF EXISTS "Authenticated users can manage contratos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload documentos" ON storage.objects;

CREATE POLICY "documentos_contratos: users view own or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documentos_contratos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "documentos_contratos: users insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documentos_contratos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documentos_contratos: users update own or admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documentos_contratos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "documentos_contratos: users delete own or admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documentos_contratos'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 4) Storage: multimedia_locales — restrict UPDATE/DELETE/INSERT to file owner;
--    keep SELECT public (it's a public bucket for media).

DROP POLICY IF EXISTS "Authenticated users can update multimedia" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update multimedia_locales" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete multimedia" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload multimedia" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to multimedia_locales" ON storage.objects;

CREATE POLICY "multimedia_locales: users insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'multimedia_locales'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "multimedia_locales: users update own or admin"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'multimedia_locales'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "multimedia_locales: users delete own or admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'multimedia_locales'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );
