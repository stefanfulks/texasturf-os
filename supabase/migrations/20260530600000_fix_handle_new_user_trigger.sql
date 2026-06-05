-- ============================================================
-- Fix "Database error saving new user" on every auth.users insert.
--
-- Diagnosis: auth.signUp() and auth.admin.{createUser, inviteUserByEmail}
-- all fail with "Database error saving new user", which means a trigger
-- on auth.users (or a chained trigger on profiles) is throwing inside
-- the transaction Supabase Auth wraps the insert in. The whole insert
-- rolls back and Auth surfaces the 500.
--
-- Hardening:
--
-- 1. Wrap public.handle_new_user's profile INSERT in BEGIN/EXCEPTION so
--    a profile-insert failure NEVER blocks the auth.users insert. The
--    app's user-management code already upserts the profile with the
--    intended role/departments, so a missed-by-trigger row will be
--    backfilled on next admin action anyway.
--
-- 2. Drop the BEFORE-INSERT side of profiles_sync_departments. The app
--    writes both `department` and `departments` whenever it touches
--    them (admin invite, change-my-department action, etc.), so we
--    don't actually need a DB-level sync. Keeping the trigger on
--    UPDATE OF department/departments is fine and harmless.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      coalesce(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION
    WHEN OTHERS THEN
      -- Don't block the auth.users insert if profile insert fails.
      -- Application code (admin invite, dashboard pick-department,
      -- etc.) upserts profiles with full row context anyway.
      RAISE WARNING 'handle_new_user: profile insert failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Recreate the trigger with the new function definition (no-op if
-- function alone changed, but harmless and idempotent).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Drop and recreate the sync trigger to fire only on UPDATE, not INSERT.
-- INSERT-time sync is unnecessary (the app provides both fields when
-- inserting) and was the most likely culprit for the chain failure.
DROP TRIGGER IF EXISTS profiles_sync_departments ON profiles;
CREATE TRIGGER profiles_sync_departments
  BEFORE UPDATE OF department, departments ON profiles
  FOR EACH ROW EXECUTE FUNCTION sync_profile_department();
