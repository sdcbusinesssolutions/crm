-- Add missing columns to appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'scheduled';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
