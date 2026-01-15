-- =================================================================
-- UPDATE TENANT LIMIT RPC
-- Description: Function to update user limits for a specific domain.
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_limit(target_domain TEXT, new_limit INTEGER)
RETURNS VOID AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- 1. Security Check: Only allow Super Admin (Role-Based)
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    -- Check if role is 'super_admin'
    IF caller_role IS DISTINCT FROM 'super_admin' THEN
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
