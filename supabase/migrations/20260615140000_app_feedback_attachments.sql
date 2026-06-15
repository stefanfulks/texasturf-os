-- ============================================================
-- App feedback v2 — screenshot attachments + soft delete.
--
-- Adds:
--   • image attachments (stored in a private `feedback` Storage bucket;
--     the row keeps a small JSON manifest of {path,name,type,size})
--   • soft delete (deleted_at / deleted_by) so admins can clear the
--     inbox and users can withdraw their own untriaged feedback without
--     destroying the record. A daily cron purges rows + their images
--     30 days after they're archived.
-- All additive — no existing column is touched.
-- ============================================================

-- ── Columns ─────────────────────────────────────────────────
-- IF NOT EXISTS keeps this safe to re-run (the repo's migration history has
-- several pending local files; this migration may be applied surgically now
-- and again later by `supabase db push`).
ALTER TABLE app_feedback
  ADD COLUMN IF NOT EXISTS attachments jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{path,name,type,size}]
  ADD COLUMN IF NOT EXISTS deleted_at  timestamptz,                              -- archived (soft delete) timestamp
  ADD COLUMN IF NOT EXISTS deleted_by  uuid REFERENCES profiles(id) ON DELETE SET NULL;

-- Active-feedback reads (user history + admin triage) all filter deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_app_feedback_active
  ON app_feedback (created_at DESC)
  WHERE deleted_at IS NULL;

-- The purge cron sweeps by archived date.
CREATE INDEX IF NOT EXISTS idx_app_feedback_deleted
  ON app_feedback (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- ── RLS: let a user update their OWN row ────────────────────
-- Needed so submitters can "withdraw" (soft-delete) their own untriaged
-- feedback. The server action is the real gatekeeper for *which* columns
-- change and *when* (status must still be 'new'); RLS just scopes it to
-- the owner's own rows. Admin update/read policies from the v1 migration
-- already cover the triage + delete + read-all paths.
DROP POLICY IF EXISTS "app_feedback: self update own" ON app_feedback;
CREATE POLICY "app_feedback: self update own"
  ON app_feedback FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Storage: private `feedback` bucket for screenshot uploads.
-- Path convention: {user_id}/{timestamp}-{filename}
-- so the first folder segment is the uploader's id — that's what the
-- policies key off. Images only, 10 MB cap.
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback',
  'feedback',
  false,
  10485760,  -- 10 MB
  ARRAY['image/png','image/jpeg','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Read: the uploader (own folder) OR any admin (for triage).
DROP POLICY IF EXISTS "feedback read own or admin" ON storage.objects;
CREATE POLICY "feedback read own or admin"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

-- Insert: only into your own folder.
DROP POLICY IF EXISTS "feedback insert own" ON storage.objects;
CREATE POLICY "feedback insert own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'feedback'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: only your own objects (rarely used; kept for parity).
DROP POLICY IF EXISTS "feedback update own" ON storage.objects;
CREATE POLICY "feedback update own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'feedback'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: the uploader (removing a draft attachment) OR an admin.
DROP POLICY IF EXISTS "feedback delete own or admin" ON storage.objects;
CREATE POLICY "feedback delete own or admin"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'feedback'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );
