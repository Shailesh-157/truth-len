-- Create a function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, total_verifications)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    0
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, do nothing
    RETURN NEW;
END;
$$;

-- Create a trigger to automatically create profiles for new users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Also create profiles for any existing users who don't have one
INSERT INTO public.profiles (user_id, display_name, total_verifications)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'display_name', au.email),
  0
FROM auth.users au
LEFT JOIN public.profiles p ON p.user_id = au.id
WHERE p.id IS NULL
ON CONFLICT (user_id) DO NOTHING;