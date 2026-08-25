-- Run this in your Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.video_guides (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    module_name TEXT NOT NULL,
    video_url TEXT NOT NULL,
    domain TEXT DEFAULT 'global',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(module_name, domain)
);

-- Optional: Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_video_guides_domain ON video_guides(domain);
CREATE INDEX IF NOT EXISTS idx_video_guides_module ON video_guides(module_name);
