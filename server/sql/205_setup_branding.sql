
-- =================================================================
-- DOMAIN BRANDING & SETTINGS
-- Description: Store white-label settings for each domain.
-- =================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.domain_settings (
    domain TEXT PRIMARY KEY,
    brand_name TEXT DEFAULT 'My Platform',
    logo_url TEXT, -- URL to image
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#2563eb', -- Default Blue
    secondary_color TEXT DEFAULT '#1e40af',
    support_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.domain_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Public Read: Anyone (even unauthenticated) needs to see the logo on the Login Page.
CREATE POLICY "Allow public read of settings"
    ON public.domain_settings FOR SELECT
    USING (true);

-- Admin Write: Only admins for that domain (or Super Admin) can update.
-- For now, we'll allow Service Role (API) full access.
CREATE POLICY "Service role full access" 
    ON public.domain_settings FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- 4. Seed Data (Examples)
INSERT INTO public.domain_settings (domain, brand_name, primary_color, support_email) VALUES
('clickube.com', 'ClicKube', '#ea580c', 'support@clickube.com'), -- Orange
('chatmat.in', 'ChatMat', '#16a34a', 'help@chatmat.in')        -- Green
ON CONFLICT (domain) DO NOTHING;
