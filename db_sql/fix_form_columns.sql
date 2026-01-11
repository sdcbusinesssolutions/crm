-- Add missing columns to forms table to match frontend types
ALTER TABLE public.forms 
ADD COLUMN IF NOT EXISTS default_group_ids TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS default_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS default_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS success_redirect_url TEXT;

-- Refresh the cache for PostgREST if needed (usually automatic)
NOTIFY pgrst, 'reload config';
