-- Add last_submission_at column to forms table
ALTER TABLE public.forms
ADD COLUMN IF NOT EXISTS last_submission_at TIMESTAMPTZ;

-- Note: The submit_form RPC might need to be updated to write to this column.
-- Alternatively, backend logic can update it separately.
