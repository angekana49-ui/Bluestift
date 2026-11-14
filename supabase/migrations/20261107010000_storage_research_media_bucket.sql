-- Research publishing storage: quarantine (contributions, private) + published
-- media (research-media, public).
--
-- The intended flow this enforces:
--   1. External proposals land in `contributions` via /api/content/contribute
--      (service role write). The bucket is NEVER served to visitors: it is the
--      quarantine inbox where files wait for security + editorial review.
--   2. Review happens out of band (team reads via signed URLs / dashboard).
--   3. Approved files are COPIED to `research-media`, and the post is published
--      (research_posts + research_post_authors + research_media rows pointing
--      at the public URL). Rejected files are deleted from quarantine.
--   4. Our own papers skip quarantine and go straight to `research-media`.
--
-- Why two buckets instead of a public prefix inside contributions: a single
-- bucket mixes untrusted pending uploads with trusted published files, and one
-- wrong policy (or one public-flag flip in the dashboard) would serve the
-- quarantine to the world. Separation is the control.

-- 1. contributions MUST stay private. Forced (not just created) so a bucket
-- made public by hand in the dashboard is pulled back to private.
INSERT INTO storage.buckets (id, name, public)
VALUES ('contributions', 'contributions', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Revert any public-read experiment on the quarantine bucket. No-op when the
-- policy was never created.
DROP POLICY IF EXISTS "Public read on public prefix" ON storage.objects;

-- 2. research-media: public reads, writes by service role only (no
-- INSERT/UPDATE/DELETE policies, so only the RLS-bypassing service role can
-- place files here — i.e. only the publish step).
INSERT INTO storage.buckets (id, name, public)
VALUES ('research-media', 'research-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS research_media_read ON storage.objects;
CREATE POLICY research_media_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'research-media');
