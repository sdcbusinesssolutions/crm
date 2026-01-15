-- =================================================================
-- UPDATE TENANT LIMIT RPC
-- Description: Function to update user limits for a specific domain.
-- =================================================================

CREATE OR REPLACE FUNCTION public.update_tenant_limit(target_domain TEXT, new_limit INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.tenant_limits (domain, user_limit)
    VALUES (target_domain, new_limit)
    ON CONFLICT (domain) DO UPDATE 
    SET user_limit = EXCLUDED.user_limit,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
