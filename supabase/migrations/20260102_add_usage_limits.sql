-- MIVNA Beta: 3-Repo Generation Limit
-- This migration adds repo generation tracking and limits

-- ============================================
-- OPTION 1: If user_usage already has columns for this, we just need the RPC
-- OPTION 2: Create a new simple table for tracking repo generations
-- ============================================

-- Create a table to track which repos each user has generated for
-- This ensures a user can regenerate for the same repo without it counting again
CREATE TABLE IF NOT EXISTS public.user_repo_generations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
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
-- Limit is hardcoded to 3 repos per user for beta
CREATE OR REPLACE FUNCTION public.check_repo_generation_limit(p_user_id UUID, p_github_repo_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_generation RECORD;
  v_current_count INTEGER;
  v_limit INTEGER := 3;  -- Hardcoded limit for beta
BEGIN
  -- Count how many unique repos the user has already generated for
  SELECT COUNT(*) INTO v_current_count
  FROM user_repo_generations
  WHERE user_id = p_user_id;
  
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
  
  RETURN jsonb_build_object(
    'allowed', true, 
    'remaining', v_limit - v_current_count - 1,
    'is_existing_repo', false
  );
END;
$$;
