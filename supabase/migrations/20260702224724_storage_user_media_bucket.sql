-- Private bucket for student uploads (Tools). Files live under `${auth.uid()}/...`
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-media', 'user-media', false)
ON CONFLICT (id) DO NOTHING;

-- Owner-scoped access: the first path segment must be the user's id.
DROP POLICY IF EXISTS user_media_read ON storage.objects;
CREATE POLICY user_media_read ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS user_media_insert ON storage.objects;
CREATE POLICY user_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS user_media_delete ON storage.objects;
CREATE POLICY user_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'user-media' AND (storage.foldername(name))[1] = auth.uid()::text);
