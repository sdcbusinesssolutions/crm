
-- =================================================================
-- TENANT SUBSCRIPTION PLANS
-- Description: Manage subscription status and expiry for tenants.
-- =================================================================

-- 1. Create table for Tenant Plans
CREATE TABLE IF NOT EXISTS public.tenant_plans (
    domain TEXT PRIMARY KEY,
    plan_name TEXT DEFAULT 'Free',
    status TEXT DEFAULT 'active', -- 'active', 'expired', 'suspended'
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.tenant_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of plans"
    ON public.tenant_plans FOR SELECT
    USING (true); 

-- 3. Update 'check_admin_status' function to include PLAN EXPIRY check
-- This function is called by the Frontend/API during login.
-- We are enhancing the existing function or replacing it.

DROP FUNCTION IF EXISTS public.check_admin_status(text);

CREATE OR REPLACE FUNCTION public.check_admin_status(check_domain TEXT)
RETURNS TABLE(is_banned BOOLEAN, fail_reason TEXT) 
SECURITY DEFINER
AS $$
DECLARE
    admin_email TEXT;
    banned_until TIMESTAMPTZ;
    plan_status TEXT;
    plan_expiry TIMESTAMPTZ;
BEGIN
    admin_email := 'Admin@' || check_domain;

    -- A. Check MANUAL BAN (Admin User Suspended)
    SELECT u.banned_until INTO banned_until
    FROM auth.users u
    WHERE CAST(u.email as TEXT) ILIKE admin_email
    LIMIT 1;

    IF banned_until IS NOT NULL AND banned_until > NOW() THEN
        RETURN QUERY SELECT true, 'Workspace Suspended by Provider';
        RETURN;
    END IF;

    -- B. Check PLAN EXPIRY (Subscription Check)
    SELECT status, expires_at INTO plan_status, plan_expiry
    FROM public.tenant_plans
    WHERE domain = check_domain;

    -- If no plan record exists, assume they are on a trial or default active (customize as needed)
    -- But if record exists, check it.
    IF plan_status IS NOT NULL THEN
        -- Check if explicit status is not active
        IF plan_status != 'active' THEN
             RETURN QUERY SELECT true, 'Subscription is ' || plan_status;
             RETURN;
        END IF;

        -- Check if expired
        IF plan_expiry IS NOT NULL AND plan_expiry < NOW() THEN
             RETURN QUERY SELECT true, 'Plan Expired on ' || TO_CHAR(plan_expiry, 'YYYY-MM-DD');
             RETURN;
        END IF;
    END IF;

    -- All checks passed
    RETURN QUERY SELECT false, 'Access Granted';
END;
$$ LANGUAGE plpgsql;

-- 4. Seed initial data (Example)
INSERT INTO public.tenant_plans (domain, plan_name, status, expires_at) VALUES 
('clickube.com', 'Enterprise', 'active', '2099-12-31'), 
('chatmat.in', 'Pro', 'active', NOW() + INTERVAL '30 days')
ON CONFLICT (domain) DO UPDATE SET 
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at;

