-- Allow authenticated users to list storage buckets (metadata only).
-- Object-level access is still controlled by storage.objects policies.
DROP POLICY IF EXISTS "Authenticated can list buckets" ON storage.buckets;
CREATE POLICY "Authenticated can list buckets"
  ON storage.buckets
  FOR SELECT
  TO authenticated
  USING (true);