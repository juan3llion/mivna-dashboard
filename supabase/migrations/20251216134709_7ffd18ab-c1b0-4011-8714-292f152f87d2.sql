-- Add github_repo_id column (unique identifier from GitHub)
ALTER TABLE repositories 
ADD COLUMN IF NOT EXISTS github_repo_id bigint UNIQUE;

-- Add file_tree column (JSONB to store filtered file structure)
ALTER TABLE repositories 
ADD COLUMN IF NOT EXISTS file_tree jsonb;

-- Make user_id nullable (webhooks don't have user context)
ALTER TABLE repositories 
ALTER COLUMN user_id DROP NOT NULL;

-- Create index for faster lookups by github_repo_id
CREATE INDEX IF NOT EXISTS idx_repositories_github_repo_id 
ON repositories(github_repo_id);