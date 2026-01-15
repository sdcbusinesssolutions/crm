
-- =================================================================
-- CASCADE BLOCK: Check Domain Status
-- Description: Function to check if the Admin of a specific domain is banned.
-- This allows us to block ALL users of a tenant if the tenant itself is suspended.
-- =================================================================

CREATE OR REPLACE FUNCTION public.check_admin_status(check_domain TEXT)
RETURNS TABLE(is_banned BOOLEAN) 
SECURITY DEFINER -- Run as Superuser to access auth.users
AS $$
DECLARE
    admin_email TEXT;
    banned_until TIMESTAMPTZ;
BEGIN
    -- unique admin email format
    admin_email := 'Admin@' || check_domain;

    -- Check status of this admin email in auth.users
    SELECT u.banned_until INTO banned_until
    FROM auth.users u
    WHERE CAST(u.email as TEXT) ILIKE admin_email
    LIMIT 1;

    -- If banned_until is in future, return true
    IF banned_until IS NOT NULL AND banned_until > NOW() THEN
        RETURN QUERY SELECT true;
    ELSE
        RETURN QUERY SELECT false;
    END IF;
END;
$$ LANGUAGE plpgsql;
