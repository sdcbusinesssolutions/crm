-- Add timezone column to follow_ups table if it doesn't exist
ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';

-- Refresh the schema cache (handled automatically by Supabase usually, but good practice to know)
NOTIFY pgrst, 'reload schema';
