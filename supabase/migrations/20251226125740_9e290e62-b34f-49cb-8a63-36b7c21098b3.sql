-- Add documentation_md column to repositories table
ALTER TABLE public.repositories 
ADD COLUMN IF NOT EXISTS documentation_md TEXT;