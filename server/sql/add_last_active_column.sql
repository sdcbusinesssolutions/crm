-- Add last_active column to contacts table if it doesn't exist
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Refresh schema cache (implicit in Supabase usually, but good to know)
NOTIFY pgrst, 'reload config';
