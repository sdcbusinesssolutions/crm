ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS media_type TEXT;
