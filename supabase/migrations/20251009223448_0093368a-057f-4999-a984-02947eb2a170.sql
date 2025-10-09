-- Fix security issues: Set search_path for functions
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.increment_user_verifications() SET search_path = public;