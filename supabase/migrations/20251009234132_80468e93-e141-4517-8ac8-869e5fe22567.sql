-- Enable realtime for verifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.verifications;

-- Enable realtime for trending_topics table
ALTER PUBLICATION supabase_realtime ADD TABLE public.trending_topics;