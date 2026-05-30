-- ============================================================
-- profiles.department: what the user DOES every day.
--
-- Orthogonal to `profiles.role` (admin / office / field). Role is the
-- permission tier; department drives the default landing experience and
-- the personalized dashboard tiles.
-- ============================================================

CREATE TYPE user_department AS ENUM (
  'sales',
  'warehouse',
  'office',
  'field',
  'marketing',
  'financial'
);

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS department user_department;

-- No default — null means "general / not assigned" and the dashboard will
-- prompt the user to pick one. Each profile can update its own department.

-- RLS: profiles already has policies. Make sure users can update their own
-- department field (this assumes a self-update policy exists; if not, add).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: self update'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles: self update" ON profiles
      FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
  END IF;
END $$;
