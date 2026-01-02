-- Add usage tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS repos_generated INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS repo_limit INTEGER NOT NULL DEFAULT 3;

-- Create a table to track which repos each user has generated for
-- This ensures a user can regenerate for the same repo without it counting again
CREATE TABLE IF NOT EXISTS public.user_repo_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  github_repo_id BIGINT NOT NULL,
  first_generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, github_repo_id)
);

-- Enable RLS on user_repo_generations
ALTER TABLE public.user_repo_generations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own generations
CREATE POLICY "Users can view their own repo generations" 
ON public.user_repo_generations FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Allow insert via service role (edge functions use service role)
CREATE POLICY "Service role can insert repo generations" 
ON public.user_repo_generations FOR INSERT 
WITH CHECK (true);

-- Policy: Allow update via service role
CREATE POLICY "Service role can update repo generations" 
ON public.user_repo_generations FOR UPDATE 
USING (true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_repo_generations_user_id 
ON public.user_repo_generations(user_id);

CREATE INDEX IF NOT EXISTS idx_user_repo_generations_lookup 
ON public.user_repo_generations(user_id, github_repo_id);

-- Function to check and register repo usage
-- Returns: { allowed: boolean, remaining: integer, is_existing_repo: boolean }
CREATE OR REPLACE FUNCTION public.check_repo_generation_limit(p_user_id UUID, p_github_repo_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_record RECORD;
  v_existing_generation RECORD;
  v_current_count INTEGER;
  v_limit INTEGER;
BEGIN
  -- Get user's profile with limit info
  SELECT repos_generated, repo_limit INTO v_profile_record
  FROM profiles
  WHERE user_id = p_user_id;
  
  IF v_profile_record IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0, 'error', 'Profile not found');
  END IF;
  
  v_current_count := COALESCE(v_profile_record.repos_generated, 0);
  v_limit := COALESCE(v_profile_record.repo_limit, 3);
  
  -- Check if user already generated for this repo (regeneration is free)
  SELECT * INTO v_existing_generation
  FROM user_repo_generations
  WHERE user_id = p_user_id AND github_repo_id = p_github_repo_id;
  
  IF v_existing_generation IS NOT NULL THEN
    -- User already generated for this repo, allow regeneration without counting
    UPDATE user_repo_generations 
    SET last_generated_at = now()
    WHERE user_id = p_user_id AND github_repo_id = p_github_repo_id;
    
    RETURN jsonb_build_object(
      'allowed', true, 
      'remaining', v_limit - v_current_count,
      'is_existing_repo', true
    );
  END IF;
  
  -- Check if user has remaining quota for new repos
  IF v_current_count >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false, 
      'remaining', 0,
      'is_existing_repo', false,
      'error', 'Generation limit reached. You have used all 3 repo generations.'
    );
  END IF;
  
  -- Register this new repo generation
  INSERT INTO user_repo_generations (user_id, github_repo_id)
  VALUES (p_user_id, p_github_repo_id);
  
  -- Increment counter
  UPDATE profiles 
  SET repos_generated = repos_generated + 1
  WHERE user_id = p_user_id;
  
  RETURN jsonb_build_object(
    'allowed', true, 
    'remaining', v_limit - v_current_count - 1,
    'is_existing_repo', false
  );
END;
$$;
