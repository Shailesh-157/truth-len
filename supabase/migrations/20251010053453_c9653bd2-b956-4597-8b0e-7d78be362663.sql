-- Fix profiles table security: Restrict access to own profile and profiles of users in verifications
-- This prevents attackers from scraping all user data

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can view profiles of users whose verifications are visible to them
-- This allows seeing display names in verification history and recent verifications
CREATE POLICY "Users can view profiles of users in verifications"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.verifications v
    WHERE v.user_id = profiles.user_id
    AND (v.user_id = auth.uid() OR v.user_id IS NULL)
  )
);