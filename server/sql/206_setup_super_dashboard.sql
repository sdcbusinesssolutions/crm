
-- =================================================================
-- SUPER ADMIN SETUPS
-- Description: Consolidated script for Branding, Settings, and Notifications
-- =================================================================

-- 1. Use the existing tables we created earlier
-- public.domain_settings (Branding)
-- public.tenant_plans (Plans)
-- public.tenant_limits (Quotas)
-- public.profiles (Users)

-- 2. Create RPC for Super Admin to Fetch All Tenants
-- Used by the new Super Dashboard
CREATE OR REPLACE FUNCTION public.get_all_tenants_summary()
RETURNS TABLE(
    domain TEXT,
    brand_name TEXT,
    user_count BIGINT,
    user_limit INTEGER,
    plan_name TEXT,
    plan_status TEXT,
    plan_expires_at TIMESTAMPTZ,
    admin_email TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.domain,
        COALESCE(ds.brand_name, 'Unknown'),
        (SELECT COUNT(*) FROM public.profiles p WHERE p.signup_domain = ds.domain),
        COALESCE(tl.user_limit, 10),
        COALESCE(tp.plan_name, 'Free'),
        COALESCE(tp.status, 'active'),
        tp.expires_at,
        ('Admin@' || ds.domain)
    FROM public.domain_settings ds
    LEFT JOIN public.tenant_limits tl ON ds.domain = tl.domain
    LEFT JOIN public.tenant_plans tp ON ds.domain = tp.domain;
END;
$$ LANGUAGE plpgsql;
