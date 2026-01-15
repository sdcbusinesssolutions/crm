-- =================================================================
-- REPAIR SCRIPT: BACKFILL ALL MISSING PROFILES
-- =================================================================

-- 1. Insert MISSING profiles for ALL existing users
-- This ensures that older admin accounts (created before multi-tenancy) are visible.
INSERT INTO public.profiles (id, email, role, signup_domain, created_at)
SELECT 
    id, 
    email, 
    'user', -- Default role
    COALESCE(raw_user_meta_data->>'signup_domain', 'clickube.com'), -- Default to master domain if unknown
    created_at
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;

-- 2. Specifically Fix 'admin@apiautomation.in' if it exists to ensure it has the right domain
UPDATE public.profiles
SET signup_domain = 'apiautomation.in', role = 'admin'
WHERE email = 'admin@apiautomation.in';

-- 3. Ensure Super Admin sees everyone by fixing RLS (Service Role Check)
-- (Already in previous script but good to double check)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'profiles'
    ) THEN
        CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Reload Schema Cache
NOTIFY pgrst, 'reload config';
