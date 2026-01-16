-- =================================================================
-- UPDATE TENANT LIMIT RPC
-- Description: Function to update user limits for a specific domain.
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_limit(target_domain TEXT, new_limit INTEGER)
RETURNS VOID AS $$
DECLARE
    caller_role TEXT;
    caller_uid UUID;
BEGIN
    -- 1. Security Check: Only allow Super Admin
    caller_uid := auth.uid();
    
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = caller_uid;

    -- Logging (visible in Supabase Logs)
    RAISE NOTICE 'update_tenant_limit called by: % (Role: %)', caller_uid, caller_role;

    -- Check if role is 'super_admin' (Case insensitive, trimmed)
    IF LOWER(TRIM(BOTH FROM COALESCE(caller_role, ''))) IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: You are not authorized. Caller: %, Role Found: %', caller_uid, COALESCE(caller_role, 'NULL');
    END IF;

    -- 2. Execute Update
    INSERT INTO public.tenant_limits (domain, user_limit)
    VALUES (target_domain, new_limit)
    ON CONFLICT (domain) DO UPDATE 
    SET user_limit = EXCLUDED.user_limit,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
