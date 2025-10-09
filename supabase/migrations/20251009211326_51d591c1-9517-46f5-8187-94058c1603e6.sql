-- Create enum for verification verdicts
CREATE TYPE public.verification_verdict AS ENUM ('true', 'false', 'misleading', 'unverified');

-- Create enum for content types
CREATE TYPE public.content_type AS ENUM ('text', 'url', 'image', 'video');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  total_verifications INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create verifications table
CREATE TABLE public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  content_type content_type NOT NULL,
  content_text TEXT,
  content_url TEXT,
  verdict verification_verdict NOT NULL,
  confidence_score INTEGER NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  explanation TEXT,
  sources JSONB,
  ai_analysis JSONB,
  is_trending BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create trending_topics table
CREATE TABLE public.trending_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_name TEXT NOT NULL,
  verification_count INTEGER DEFAULT 0,
  average_accuracy INTEGER,
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trending_topics ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Verifications policies
CREATE POLICY "Users can view their own verifications"
  ON public.verifications FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can create verifications"
  ON public.verifications FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update their own verifications"
  ON public.verifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Trending topics policies (public read)
CREATE POLICY "Trending topics are viewable by everyone"
  ON public.trending_topics FOR SELECT
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to increment verification count
CREATE OR REPLACE FUNCTION public.increment_user_verifications()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET total_verifications = total_verifications + 1
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to increment verification count
CREATE TRIGGER increment_verification_count
  AFTER INSERT ON public.verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_user_verifications();

-- Create indexes for better performance
CREATE INDEX idx_verifications_user_id ON public.verifications(user_id);
CREATE INDEX idx_verifications_created_at ON public.verifications(created_at DESC);
CREATE INDEX idx_verifications_trending ON public.verifications(is_trending) WHERE is_trending = true;
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);