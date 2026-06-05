-- ============================================================
-- Persist Google OAuth tokens per user.
--
-- Supabase Auth only returns provider_token + provider_refresh_token
-- inside the session at the moment of the OAuth code exchange. After
-- that, getSession() drops them. To keep using Google APIs (Calendar,
-- etc.) on later requests we capture both at /auth/callback and store
-- them here, then refresh on demand via Google's OAuth endpoint.
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS google_access_token   text,
  ADD COLUMN IF NOT EXISTS google_refresh_token  text,
  ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz;

-- No new RLS policy needed — profiles already has self-read +
-- admin-update-any + self-update. The /auth/callback handler writes
-- via the service-role client so RLS doesn't apply on the write path.
