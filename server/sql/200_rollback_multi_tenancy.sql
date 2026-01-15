-- =================================================================
-- SOFT ROLLBACK MULTI-TENANCY (NO DATA LOSS)
-- =================================================================
-- Description: Disables Multi-Tenancy Logic (Triggers, Functions, RLS)
-- BUT KEEPS THE TABLES AND DATA INTACT.
--
-- After running this:
-- 1. New users will NOT be automatically added to 'profiles'.
-- 2. Tenant Limits will NOT be enforced.
-- 3. Plan checks will NOT run.
-- 4. RLS policies will be removed (Data becomes open to Service Role or disabled RLS).
--
-- YOUR DATA IN 'profiles', 'tenant_plans', 'domain_settings' WILL REMAIN SAFE.
-- =================================================================

-- 1. Detach and Drop Triggers
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS check_limit_before_profile_insert ON public.profiles;

-- 2. Disable RLS (Row Level Security) on Tables
-- This ensures the data exists but isn't hidden/locked by the policies we are about to delete.
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_settings DISABLE ROW LEVEL SECURITY;

-- 3. Drop Policies (Cleanup)
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Service role full access" ON public.profiles;
DROP POLICY IF EXISTS "Allow public read of limits" ON public.tenant_limits;
DROP POLICY IF EXISTS "Allow public read of plans" ON public.tenant_plans;
DROP POLICY IF EXISTS "Allow public read of settings" ON public.domain_settings;

-- 4. Drop Functions (Logic)
-- Note: If your Frontend App tries to call these RPCs, it will fail. 
-- Ensure you revert Frontend Code if you run this.
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.check_tenant_limit();
DROP FUNCTION IF EXISTS public.check_admin_status(text);
DROP FUNCTION IF EXISTS public.check_user_plan_status(uuid);
DROP FUNCTION IF EXISTS public.check_tenant_plan_notification(text);
DROP FUNCTION IF EXISTS public.get_all_tenants_summary();

-- 5. OPTIONAL: Rename tables to backup if you want to "hide" them but keep data
-- ALTER TABLE public.profiles RENAME TO profiles_backup;
-- ALTER TABLE public.tenant_limits RENAME TO tenant_limits_backup;
-- ALTER TABLE public.tenant_plans RENAME TO tenant_plans_backup;
-- ALTER TABLE public.domain_settings RENAME TO domain_settings_backup;

-- =================================================================
-- ROLLBACK COMPLETE - DATA PRESERVED
-- =================================================================
