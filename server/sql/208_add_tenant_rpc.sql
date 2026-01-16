-- =================================================================
-- ADD NEW TENANT RPC
-- Description: Super Admin function to manually register a new tenant.
-- This populates limits, plans, and basic branding.
-- =================================================================

CREATE OR REPLACE FUNCTION public.add_new_tenant(
    new_domain TEXT, 
    initial_limit INTEGER DEFAULT 10,
    plan_name TEXT DEFAULT 'Free'
)
RETURNS VOID AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- 1. Security Check: Only Super Admin
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    
    IF LOWER(TRIM(BOTH FROM COALESCE(caller_role, ''))) IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can add tenants. Your role: %', caller_role;
    END IF;

    -- 2. Normalize Domain
    new_domain := lower(trim(new_domain));

    -- 3. Insert into Domain Settings (Branding)
    INSERT INTO public.domain_settings (domain, brand_name)
    VALUES (new_domain, INITCAP(SPLIT_PART(new_domain, '.', 1)))
    ON CONFLICT (domain) DO NOTHING;

    -- 4. Insert into Tenant Limits
    INSERT INTO public.tenant_limits (domain, user_limit)
    VALUES (new_domain, initial_limit)
    ON CONFLICT (domain) DO UPDATE SET user_limit = EXCLUDED.user_limit;

    -- 5. Insert into Tenant Plans
    INSERT INTO public.tenant_plans (domain, plan_name, status, expires_at)
    VALUES (new_domain, plan_name, 'active', NOW() + INTERVAL '30 days')
    ON CONFLICT (domain) DO NOTHING;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
