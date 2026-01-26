
-- Add flow_id to sheet_automations
ALTER TABLE public.sheet_automations ADD COLUMN IF NOT EXISTS flow_id uuid REFERENCES public.flows(id) ON DELETE SET NULL;

-- Notify PostgREST to refresh schema cache (Specific to Supabase/PostgREST)
NOTIFY pgrst, 'reload config';
