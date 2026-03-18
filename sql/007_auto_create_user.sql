-- Auto-create a row in public.users when someone signs up via Supabase Auth
-- This bridges auth.users → public.users so foreign keys work

-- 1. Create function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, created_at, updated_at)
  VALUES (
    NEW.id::TEXT,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill existing auth users who don't have a public.users row yet
INSERT INTO public.users (id, email, display_name, created_at, updated_at)
SELECT
  au.id::TEXT,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = au.id::TEXT)
ON CONFLICT (id) DO NOTHING;
