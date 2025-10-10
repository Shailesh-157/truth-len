-- Add RLS policies for trending_topics table to prevent unauthorized modifications
-- Only admins should be able to INSERT, UPDATE, or DELETE trending topics

-- Policy: Only admins can insert trending topics
CREATE POLICY "Admins can insert trending topics"
ON public.trending_topics
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can update trending topics
CREATE POLICY "Admins can update trending topics"
ON public.trending_topics
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Policy: Only admins can delete trending topics
CREATE POLICY "Admins can delete trending topics"
ON public.trending_topics
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));