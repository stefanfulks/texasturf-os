-- ============================================================
-- Jobber audit follow-ups: explicit admin-only policies + webhook dedupe.
--
-- 1. RLS posture made explicit.
--
--    jobber_oauth_tokens, jobber_webhook_events, and jobber_jobs all enable
--    RLS but ship with ZERO policies. That's actually default-deny for
--    authenticated users — and service-role bypasses — so today's behavior
--    is correct. But it's a fragile posture: a future refactor switching
--    a page from supabaseAdmin() to the user-context client would silently
--    return zero rows with no error.
--
--    Add explicit admin-only SELECT policies so the read posture is visible
--    in the schema and survives a refactor.
--
-- 2. Webhook idempotency.
--
--    jobber_webhook_events has no unique constraint. Jobber retries on
--    missed acks, and the previous handler inserted a new audit row each
--    time + re-ran dispatch. The entity-mirror writes are idempotent via
--    upsert(onConflict: id) so duplicates didn't corrupt mirrors, but
--    every retry burned a Jobber sync cost + an audit row.
--
--    Add a nullable occured_at column (from the webHookEvent.occuredAt
--    field) and a UNIQUE constraint on (topic, item_id, occured_at). The
--    handler upserts with ignoreDuplicates and skips dispatch when no
--    new row landed.
-- ============================================================

-- Admin-only SELECT on the three tables that were policy-less. Service-role
-- still bypasses, so the sync code keeps working as-is.

DROP POLICY IF EXISTS "jobber_oauth_tokens admin read"   ON public.jobber_oauth_tokens;
CREATE POLICY "jobber_oauth_tokens admin read"
  ON public.jobber_oauth_tokens FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "jobber_webhook_events admin read" ON public.jobber_webhook_events;
CREATE POLICY "jobber_webhook_events admin read"
  ON public.jobber_webhook_events FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "jobber_jobs read" ON public.jobber_jobs;
CREATE POLICY "jobber_jobs read"
  ON public.jobber_jobs FOR SELECT
  TO authenticated USING (true);
  -- Match jobber_clients / jobber_visits posture: all staff can see jobs.

-- Idempotency: capture occuredAt + a unique index.
-- Existing rows have NULL occured_at; the UNIQUE treats NULLs as distinct
-- so the backfill case doesn't conflict.
ALTER TABLE public.jobber_webhook_events
  ADD COLUMN IF NOT EXISTS occured_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS jobber_webhook_events_dedupe_idx
  ON public.jobber_webhook_events (topic, item_id, occured_at);
