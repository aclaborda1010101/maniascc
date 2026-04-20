-- Bucket privado para adjuntos del chat AVA
INSERT INTO storage.buckets (id, name, public)
VALUES ('ava_attachments', 'ava_attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Policies: cada usuario sube/lee/borra solo en su carpeta {user_id}/...
CREATE POLICY "AVA attachments: users read own"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'ava_attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "AVA attachments: users insert own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ava_attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "AVA attachments: users delete own"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'ava_attachments' AND auth.uid()::text = (storage.foldername(name))[1]);