
-- Storage RLS policies for documentos_contratos
CREATE POLICY "Authenticated users can manage contratos"
ON storage.objects FOR ALL
USING (bucket_id = 'documentos_contratos' AND auth.uid() IS NOT NULL)
WITH CHECK (bucket_id = 'documentos_contratos' AND auth.uid() IS NOT NULL);

-- Storage RLS policies for multimedia_locales (public read, auth write)
CREATE POLICY "Anyone can view multimedia"
ON storage.objects FOR SELECT
USING (bucket_id = 'multimedia_locales');

CREATE POLICY "Authenticated users can upload multimedia"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'multimedia_locales' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update multimedia"
ON storage.objects FOR UPDATE
USING (bucket_id = 'multimedia_locales' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete multimedia"
ON storage.objects FOR DELETE
USING (bucket_id = 'multimedia_locales' AND auth.uid() IS NOT NULL);
