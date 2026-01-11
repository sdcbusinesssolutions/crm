-- Drop table to ensure schema update (if it existed as uuid type)
DROP TABLE IF EXISTS public.onboarding_settings;

-- Create a table for Onboarding Settings (System Wide)
CREATE TABLE public.onboarding_settings (
    -- user_id can be a specific user UUID or a keyword like 'system' for global admin settings
    user_id text NOT NULL DEFAULT 'system', 
    manual_enabled boolean DEFAULT false,
    embedded_enabled boolean DEFAULT false,
    embedded_app_id text,
    embedded_app_secret text,
    embedded_config_id text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY (user_id)
);

-- Enable Row Level Security
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow Service Role full access, others read-only if needed)
-- For Admin API (Service Role), RLS is bypassed automatically if using supabaseAdmin.
-- But we can add policies for safety if authenticated users need read access.

CREATE POLICY "Allow Service Role full access"
    ON public.onboarding_settings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Optional: Allow authenticated users to READ only (if they need to know if onboarding is enabled)
CREATE POLICY "Allow authenticated users to read system settings"
    ON public.onboarding_settings
    FOR SELECT
    TO authenticated
    USING (user_id = 'system');

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_onboarding_settings_updated
    BEFORE UPDATE ON public.onboarding_settings
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();

-- Grant permissions (adjust as needed for your roles)
GRANT ALL ON public.onboarding_settings TO authenticated;
GRANT ALL ON public.onboarding_settings TO service_role;
