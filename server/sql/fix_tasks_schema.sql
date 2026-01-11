-- Add missing columns to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Also ensure 'status' exists if used elsewhere, though route uses is_completed
-- The route uses: user_id, lead_id, title, description, due_date, is_completed

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
