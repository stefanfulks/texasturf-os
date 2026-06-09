-- ============================================================
-- Move Google OAuth tokens off profiles into a dedicated table.
--
-- Audit finding: profiles' SELECT policy is `to authenticated using (true)`,
-- which means any signed-in user can SELECT google_refresh_token from any
-- other user's profile via the user-context Supabase client. Storing OAuth
-- tokens on profiles couples them to that broad read policy.
--
-- Fix: dedicated google_oauth_tokens table with RLS enabled and NO policies.
-- All access is via the service-role client (createServiceClient), which
-- bypasses RLS — the default-deny posture means no authenticated user can
-- read tokens directly, even via a hand-crafted query.
--
-- We backfill existing rows and NULL out the profile columns to plug the
-- leak now. Dropping the columns themselves is destructive DDL and is
-- deferred to a follow-up migration once code paths are confirmed clean.
--
-- DEPLOY ORDER: this migration must be applied BEFORE Vercel finishes
-- deploying the matching code change (src/lib/google/tokens.ts). If the
-- new code lands first, it will read from google_oauth_tokens which won't
-- exist yet and users will appear signed-out of Google until the migration
-- runs.
-- ============================================================

CREATE TABLE IF NOT EXISTS google_oauth_tokens (
  user_id        uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  access_token   text,
  refresh_token  text,
  expires_at     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- No policies on purpose. Default-deny for everyone; service-role bypasses.

-- Backfill from profiles for any user who has tokens.
INSERT INTO google_oauth_tokens (user_id, access_token, refresh_token, expires_at)
SELECT id, google_access_token, google_refresh_token, google_token_expires_at
FROM profiles
WHERE google_access_token IS NOT NULL
   OR google_refresh_token IS NOT NULL
   OR google_token_expires_at IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- Plug the leak: clear the values from profiles. The columns themselves
-- stay (destructive DDL deferred), but they're empty now.
UPDATE profiles
SET google_access_token = NULL,
    google_refresh_token = NULL,
    google_token_expires_at = NULL
WHERE google_access_token IS NOT NULL
   OR google_refresh_token IS NOT NULL
   OR google_token_expires_at IS NOT NULL;
