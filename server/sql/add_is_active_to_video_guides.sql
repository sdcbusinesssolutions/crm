-- Add is_active column to video_guides table
ALTER TABLE public.video_guides ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create an index for faster lookups when filtering by active status
CREATE INDEX IF NOT EXISTS idx_video_guides_is_active ON public.video_guides(is_active);

-- Create a composite index for the fastest possible lookups on the user side (module_name + domain + is_active)
CREATE INDEX IF NOT EXISTS idx_video_guides_user_lookup ON public.video_guides(module_name, domain, is_active);
