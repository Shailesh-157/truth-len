-- Remove anonymous access from verifications table
-- Users must be authenticated to create or view verifications

DROP POLICY IF EXISTS "Users can view their own verifications and anonymous ones" ON public.verifications;
DROP POLICY IF EXISTS "Users can create verifications" ON public.verifications;
DROP POLICY IF EXISTS "Users can update their own verifications" ON public.verifications;
DROP POLICY IF EXISTS "Users can delete their own verifications" ON public.verifications;

-- Create new strict RLS policies requiring authentication
CREATE POLICY "Authenticated users can view their own verifications"
ON public.verifications
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create their own verifications"
ON public.verifications
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can update their own verifications"
ON public.verifications
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete their own verifications"
ON public.verifications
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);