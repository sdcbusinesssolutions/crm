ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS location_header JSONB DEFAULT '{}'::jsonb;
