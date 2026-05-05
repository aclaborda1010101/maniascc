DROP POLICY IF EXISTS "Public can list bucket metadata" ON storage.buckets;
DROP POLICY IF EXISTS "Authenticated can list buckets" ON storage.buckets;

CREATE POLICY "Public can list bucket metadata"
ON storage.buckets
FOR SELECT
TO public
USING (true);