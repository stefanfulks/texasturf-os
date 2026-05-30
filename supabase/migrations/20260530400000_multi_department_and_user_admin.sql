-- ============================================================
-- Multi-department support + admin user-management surface.
--
-- A user can belong to multiple departments (e.g. an office manager
-- who also touches financial reports). We replace the single-value
-- profiles.department column with an array.
--
-- The existing pick-one prompt keeps working — picking one value just
-- writes a single-element array.
-- ============================================================

-- Add the new array column. Keep `department` (singular) for one
-- transitional release so any in-flight UI that still reads it doesn't
-- crash; we'll backfill from it.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS departments user_department[] NOT NULL DEFAULT '{}';

-- Backfill: lift the current single department into the array
UPDATE profiles
   SET departments = ARRAY[department]
 WHERE department IS NOT NULL
   AND (departments IS NULL OR departments = '{}'::user_department[]);

-- Index for queries that scope by department
CREATE INDEX IF NOT EXISTS idx_profiles_departments
  ON profiles USING GIN (departments);

-- Make sure admins can read all profiles and update roles+departments
-- for ANY user. (Self-update policy from migration 20260530100000 still
-- allows users to update their own profile.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles: admin update any'
  ) THEN
    EXECUTE 'CREATE POLICY "profiles: admin update any" ON profiles
      FOR UPDATE USING (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ''admin'')
      ) WITH CHECK (
        EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = ''admin'')
      )';
  END IF;
END $$;

-- Optional: keep the singular column in sync with the first element of
-- the array so reads of either stay consistent during the transition.
CREATE OR REPLACE FUNCTION sync_profile_department()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.departments IS NOT NULL AND array_length(NEW.departments, 1) >= 1 THEN
    NEW.department := NEW.departments[1];
  ELSIF NEW.department IS NOT NULL
        AND (NEW.departments IS NULL OR NEW.departments = '{}'::user_department[]) THEN
    NEW.departments := ARRAY[NEW.department];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_sync_departments ON profiles;
CREATE TRIGGER profiles_sync_departments
  BEFORE INSERT OR UPDATE OF department, departments ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_department();
