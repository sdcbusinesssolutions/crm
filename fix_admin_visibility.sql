-- =================================================================
-- FIX ADMIN VISIBILITY & SCHEMA CACHE
-- =================================================================

-- 1. Ensure Profiles Table Exists
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    signup_domain TEXT, 
    role TEXT DEFAULT 'user', 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    plan_name TEXT DEFAULT 'Free',
    plan_status TEXT DEFAULT 'active',
    plan_expires_at TIMESTAMPTZ,
    last_notification_sent_at TIMESTAMPTZ
);

-- 2. Ensure Service Role Access Policy (Required for Admin Panel)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'profiles'
    ) THEN
        CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 3. Insert or Update the User Record
-- This ensures the row exists even if the trigger failed previously
INSERT INTO public.profiles (id, email, signup_domain, role, created_at)
SELECT 
    id, 
    email, 
    'apiautomation.in', -- Force correct domain
    'user',
    created_at
FROM auth.users
WHERE email = 'api@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET signup_domain = 'apiautomation.in';

-- 4. Reload Supabase Schema Cache
-- This fixes the "no users found" or "table not found" errors in the API
NOTIFY pgrst, 'reload config';
