-- =================================================================
-- MIGRATION 211: DEFAULT TRIAL PERIOD & USER DELETE RULES
-- =================================================================
-- Changes:
--   1. Update handle_new_user() trigger to set a 7-day Free Trial
--      on every new signup (TRIAL_DAYS is controlled server-side via ENV).
--   2. Document the delete permission rules enforced in UsersController.js:
--       - Tenant Admin: can delete a user ONLY if:
--           a) User has NO paid plan (plan_name = 'Free Trial' or 'Free')  AND
--           b) User account is <= TENANT_ADMIN_DELETE_WINDOW_DAYS old (default 9)
--       - Super Admin: can ALWAYS delete any user.
-- =================================================================

-- Step 1: Add a helper column to track whether a paid plan was
--         ever assigned (separate from trial).
-- This lets the deletion logic quickly check eligibility without
-- parsing plan_name strings.
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.profiles
            ADD COLUMN plan_assigned_by_admin BOOLEAN DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

COMMENT ON COLUMN public.profiles.plan_assigned_by_admin IS
    'TRUE when a Tenant/Super Admin has explicitly assigned a paid plan. '
    'When TRUE, Tenant Admin cannot delete the user.';

-- Step 2: Update the handle_new_user() trigger to stamp a 7-day trial.
-- NOTE: The actual number of days is also set in UsersController.js via
--       the TRIAL_DAYS environment variable. Keep both in sync.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_data JSONB;
    s_domain  TEXT;
    trial_days INTEGER := 7; -- Default trial. Override via server ENV (TRIAL_DAYS).
BEGIN
    user_data := to_jsonb(new);

    -- Extract signup_domain from user metadata
    s_domain := COALESCE(
        (user_data->'raw_user_meta_data'->>'signup_domain'),
        (user_data->'user_metadata'->>'signup_domain'),
        'unknown'
    );

    INSERT INTO public.profiles (
        id,
        email,
        signup_domain,
        role,
        plan_name,
        plan_status,
        plan_expires_at,
        plan_assigned_by_admin
    )
    VALUES (
        new.id,
        new.email,
        s_domain,
        'user',
        'Free Trial',                            -- Default plan name
        'active',                                -- Active by default
        NOW() + (trial_days || ' days')::INTERVAL, -- 7-day trial window
        FALSE                                    -- No admin plan yet
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- =================================================================
-- HOW TO RUN:
--   Paste this entire file into your Supabase SQL Editor and execute.
-- =================================================================
