-- Add bookmark column to verifications table
ALTER TABLE public.verifications 
ADD COLUMN is_bookmarked BOOLEAN DEFAULT false;

-- Create index for faster bookmark queries
CREATE INDEX idx_verifications_bookmarked 
ON public.verifications (user_id, is_bookmarked) 
WHERE is_bookmarked = true;