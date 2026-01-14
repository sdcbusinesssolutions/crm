
-- ==========================================================
-- ROLLBACK: Onboarding Settings Table
-- ==========================================================

-- 1. Drop RLS Policies (Optional if dropping table, but good practice)
DROP POLICY IF EXISTS "Users can view their own onboarding settings" ON public.onboarding_settings;
DROP POLICY IF EXISTS "Users can insert their own onboarding settings" ON public.onboarding_settings;
DROP POLICY IF EXISTS "Users can update their own onboarding settings" ON public.onboarding_settings;
DROP POLICY IF EXISTS "Users can delete their own onboarding settings" ON public.onboarding_settings;

-- 2. Drop Table
-- This will delete all data stored in onboarding_settings
DROP TABLE IF EXISTS public.onboarding_settings;

-- 3. Verification output
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'onboarding_settings') THEN
        RAISE NOTICE 'Table onboarding_settings dropped successfully.';
    END IF;
END $$;
