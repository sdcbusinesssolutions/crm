
-- ==========================================================
-- ONBOARDING SETTINGS TABLE (Unified System & User Support)
-- ==========================================================

-- 1. Create Table if not exists
CREATE TABLE IF NOT EXISTS public.onboarding_settings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE, -- TEXT to support 'system' and UUIDs
    
    manual_enabled BOOLEAN DEFAULT false,
    embedded_enabled BOOLEAN DEFAULT false,
    
    embedded_app_id TEXT,
    embedded_app_secret TEXT,
    embedded_config_id TEXT,
    
    -- New field to specify the bridge domain (e.g., 'https://cloudospire.in')
    -- If NULL, defaults to process.env.BRIDGE_DOMAIN or 'https://cloudospire.in' in code
    bridge_domain TEXT, 

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- ADDED: Explicitly add column if table exists but column is missing (Migration Support)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_settings' AND column_name='bridge_domain') THEN
        ALTER TABLE public.onboarding_settings ADD COLUMN bridge_domain TEXT;
    END IF;
END $$;

-- 2. Ensure RLS is enabled
ALTER TABLE public.onboarding_settings ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies

-- Allow Users to View their OWN settings
DROP POLICY IF EXISTS "Users can view their own onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Users can view their own onboarding settings" 
ON public.onboarding_settings 
FOR SELECT 
USING (auth.uid()::text = user_id);

-- Allow Users to Insert their OWN settings
DROP POLICY IF EXISTS "Users can insert their own onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Users can insert their own onboarding settings" 
ON public.onboarding_settings 
FOR INSERT 
WITH CHECK (auth.uid()::text = user_id);

-- Allow Users to Update their OWN settings
DROP POLICY IF EXISTS "Users can update their own onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Users can update their own onboarding settings" 
ON public.onboarding_settings 
FOR UPDATE 
USING (auth.uid()::text = user_id);

-- Allow Users to Delete their OWN settings
DROP POLICY IF EXISTS "Users can delete their own onboarding settings" ON public.onboarding_settings;
CREATE POLICY "Users can delete their own onboarding settings" 
ON public.onboarding_settings 
FOR DELETE 
USING (auth.uid()::text = user_id);

-- Note: 'system' user rows are accessed via Service Role (supabaseAdmin) which bypasses RLS.
