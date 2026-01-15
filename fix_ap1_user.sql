-- =================================================================
-- FIX ADMIN VISIBILITY FOR ap1@gmail.com
-- =================================================================

-- 1. Insert or Update the User Record for ap1@gmail.com
INSERT INTO public.profiles (id, email, signup_domain, role, created_at)
SELECT 
    id, 
    email, 
    'apiautomation.in', -- Force correct domain
    'user',
    created_at
FROM auth.users
WHERE email = 'ap1@gmail.com'
ON CONFLICT (id) DO UPDATE 
SET signup_domain = 'apiautomation.in';

-- 2. Reload Supabase Schema Cache
NOTIFY pgrst, 'reload config';
