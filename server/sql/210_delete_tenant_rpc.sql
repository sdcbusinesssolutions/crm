-- =================================================================
-- DELETE TENANT RPC
-- Description: Completely removes a tenant and its associated data.
-- Security: SUPER ADMIN ONLY.
-- =================================================================

CREATE OR REPLACE FUNCTION public.delete_tenant(target_domain TEXT)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- 1. Security Check: Must be Super Admin
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can delete tenants.';
    END IF;

    -- Prevent deleting the master domain (safety mechanism)
    -- Assuming clickube.com or apiautomation.in are critical, but let's just warn or allow.
    -- Better safe than sorry:
    IF target_domain = 'clickube.com' THEN
        RAISE EXCEPTION 'Cannot delete the Master Tenant (clickube.com).';
    END IF;

    -- 2. Delete Tenant Configurations
    DELETE FROM public.tenant_limits WHERE domain = target_domain;
    DELETE FROM public.tenant_plans WHERE domain = target_domain;
    DELETE FROM public.onboarding_settings WHERE domain = target_domain; -- Branding

    -- 3. Delete Users (Profiles)
    -- Note: This deletes from public.profiles. 
    -- If there is a foreign key to auth.users with ON DELETE CASCADE, great.
    -- If not, the auth user remains but has no profile (effectively 'deleted' from app).
    -- For complete cleanup, one would need to delete from auth.users, which requires
    -- calling `supabase.auth.admin.deleteUser` from a backend service, OR 
    -- using a trigger/cron. This RPC handles the *App Data*.
    DELETE FROM public.profiles WHERE signup_domain = target_domain;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Tenant ' || target_domain || ' and its data have been deleted.'
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'message', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;
