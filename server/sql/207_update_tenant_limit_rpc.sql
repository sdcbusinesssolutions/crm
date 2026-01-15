-- =================================================================
-- UPDATE TENANT LIMIT RPC
-- Description: Function to update user limits for a specific domain.
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_limit(target_domain TEXT, new_limit INTEGER)
RETURNS VOID AS $$
DECLARE
    caller_domain TEXT;
BEGIN
    -- 1. Security Check: Only allow Super Admin (Master Domain)
    -- Get the domain of the executing user
    SELECT signup_domain INTO caller_domain
    FROM public.profiles
    WHERE id = auth.uid();

    -- Check if domain is authorized (e.g. clickube.com)
    -- You can also check for role = 'super_admin' if you implement roles later
    IF caller_domain NOT IN ('clickube.com', 'localhost') THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can update limits.';
    END IF;

    -- 2. Execute Update
    INSERT INTO public.tenant_limits (domain, user_limit)
    VALUES (target_domain, new_limit)
    ON CONFLICT (domain) DO UPDATE 
    SET user_limit = EXCLUDED.user_limit,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
