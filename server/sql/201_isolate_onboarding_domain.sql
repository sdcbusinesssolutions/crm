-- ==========================================================
-- ISOLATE ONBOARDING SETTINGS BY DOMAIN (Idempotent Fix)
-- ==========================================================

-- 1. Add 'domain' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='onboarding_settings' AND column_name='domain') THEN
        ALTER TABLE public.onboarding_settings ADD COLUMN domain TEXT DEFAULT 'clickube.com';
    END IF;
END $$;

-- 2. Drop the old UNIQUE constraint on user_id (Single Global Record)
ALTER TABLE public.onboarding_settings DROP CONSTRAINT IF EXISTS onboarding_settings_user_id_key;

-- 3. Add new Composite UNIQUE constraint (user_id + domain)
-- We drop it first to ensure idempotency (Fixes ERROR: 42P07)
ALTER TABLE public.onboarding_settings DROP CONSTRAINT IF EXISTS onboarding_settings_userid_domain_key;
ALTER TABLE public.onboarding_settings ADD CONSTRAINT onboarding_settings_userid_domain_key UNIQUE (user_id, domain);

-- 4. Update the existing 'system' record to belong to the default master domain if null
UPDATE public.onboarding_settings 
SET domain = 'clickube.com' 
WHERE user_id = 'system' AND (domain IS NULL OR domain = '');
