-- =================================================================
-- GET MY TENANT STATS RPC
-- Description: Helper function for Tenant Admins to see their usage.
-- Returns: { user_count, user_limit, plan_name, days_left }
-- =================================================================

CREATE OR REPLACE FUNCTION public.get_my_tenant_stats()
RETURNS TABLE(
    user_count BIGINT,
    user_limit INTEGER,
    plan_name TEXT,
    days_left INTEGER
) 
SECURITY DEFINER
AS $$
DECLARE
    my_domain TEXT;
    my_limit INTEGER;
    my_plan TEXT;
    my_expiry TIMESTAMPTZ;
BEGIN
    -- 1. Get Current User's Domain
    SELECT signup_domain INTO my_domain
    FROM public.profiles
    WHERE id = auth.uid();

    -- 2. Get Limit
    SELECT t.user_limit INTO my_limit
    FROM public.tenant_limits t
    WHERE t.domain = my_domain;

    -- Default if missing
    IF my_limit IS NULL THEN my_limit := 10; END IF;

    -- 3. Get Plan Info
    SELECT p.plan_name, p.expires_at INTO my_plan, my_expiry
    FROM public.tenant_plans p
    WHERE p.domain = my_domain;

    -- Default Plan
    IF my_plan IS NULL THEN my_plan := 'Free'; END IF;

    -- 4. Get User Count
    SELECT COUNT(*) INTO user_count
    FROM public.profiles
    WHERE signup_domain = my_domain;

    -- 5. Calculate Days Left
    IF my_expiry IS NOT NULL THEN
        days_left := EXTRACT(DAY FROM (my_expiry - NOW()))::INTEGER;
    ELSE
        days_left := 999;
    END IF;

    RETURN QUERY SELECT 
        user_count, 
        my_limit, 
        my_plan, 
        days_left;
END;
$$ LANGUAGE plpgsql;
