-- =============================================
-- FIX: Auto-create user_roles on signup
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles
  INSERT INTO public.profiles (id, first_name, last_name, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    first_name = COALESCE(EXCLUDED.first_name, profiles.first_name),
    last_name = COALESCE(EXCLUDED.last_name, profiles.last_name);

  -- Insert into user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')::app_role
  )
  ON CONFLICT (user_id) DO UPDATE SET
    role = COALESCE(EXCLUDED.role, user_roles.role);

  -- If role is nurse or doctor, create clinician_profiles entry
  IF NEW.raw_user_meta_data->>'role' IN ('nurse', 'doctor') THEN
    INSERT INTO public.clinician_profiles (id, specialization, is_available)
    VALUES (
      NEW.id,
      CASE 
        WHEN NEW.raw_user_meta_data->>'role' = 'nurse' THEN 'General Nursing'
        ELSE 'General Practice'
      END,
      true
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Make sure the trigger exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Fix existing users who don't have roles
-- This will create roles for any users missing from user_roles table
INSERT INTO public.user_roles (user_id, role)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'role', 'patient')::app_role
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
WHERE ur.user_id IS NULL;

-- 4. Verify the fix
SELECT 
  au.email,
  au.raw_user_meta_data->>'role' as metadata_role,
  ur.role as assigned_role
FROM auth.users au
LEFT JOIN public.user_roles ur ON ur.user_id = au.id
ORDER BY au.created_at DESC
LIMIT 10;
