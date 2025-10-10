-- Drop the overly permissive policy that allows viewing profiles of users in verifications
DROP POLICY IF EXISTS "Users can view profiles of users in verifications" ON public.profiles;

-- The "Users can view their own profile" policy remains, which only allows auth.uid() = user_id
-- This ensures users can only access their own profile data

-- If you need to display profile information publicly (e.g., showing who created a verification),
-- you should implement a controlled mechanism such as:
-- 1. A separate public_profiles view with only non-sensitive fields
-- 2. An RPC function that returns limited profile data for specific use cases
-- 3. Embedding necessary profile data directly in the verifications table when needed