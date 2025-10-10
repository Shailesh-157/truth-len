-- Fix feedback table security issue: make user_id required

-- First, delete any orphaned feedback records with NULL user_id
DELETE FROM public.feedback WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE public.feedback ALTER COLUMN user_id SET NOT NULL;

-- Drop the existing INSERT policy that allowed NULL user_id
DROP POLICY IF EXISTS "Users can create feedback" ON public.feedback;

-- Create new INSERT policy that requires authentication
CREATE POLICY "Users can create feedback"
ON public.feedback
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);