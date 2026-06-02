-- Fix: handle_new_user trigger was using ON CONFLICT (id) DO NOTHING, which
-- only catches primary-key conflicts. If a profile row with the same email
-- exists (e.g. a previously deleted user whose profile was not cascade-deleted),
-- the trigger throws an unhandled unique_violation and Supabase Auth surfaces it
-- as "Database error saving new user".
--
-- Changing to ON CONFLICT DO NOTHING handles ALL unique constraints (id and
-- email) so the trigger never blocks auth user creation. The inviteUser server
-- action always upserts the profile after the invite anyway.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
