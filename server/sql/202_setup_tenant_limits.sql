
-- =================================================================
-- TENANT LIMITS & QUOTAS
-- Description: Table to store limits for each tenant (domain).
-- =================================================================

-- 1. Create table for Tenant Limits
CREATE TABLE IF NOT EXISTS public.tenant_limits (
    domain TEXT PRIMARY KEY,
    user_limit INTEGER DEFAULT 10,  -- Default limit if not specified
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS (Only Admin/Service Role can read/write)
ALTER TABLE public.tenant_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read of limits"
    ON public.tenant_limits FOR SELECT
    USING (true); -- Needed so the Signup Trigger can read it

-- 3. Function to check limit before user creation
-- This runs BEFORE the user is saved to the profiles table.
-- Note: We can't easily block auth.users insertion from a trigger on profiles table
-- because Supabase auth happens first.
-- STRATEGY: We will throw an error in the 'handle_new_user' trigger function.
-- If the trigger fails, the transaction usually rolls back or at least fails the profile creation.

CREATE OR REPLACE FUNCTION public.check_tenant_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_limit INTEGER;
    user_domain TEXT;
BEGIN
    user_domain := COALESCE(new.signup_domain, new.raw_user_meta_data->>'signup_domain', 'unknown');

    -- Ignore limit check for Master Domain if needed (Optional)
    -- IF user_domain = 'clickube.com' THEN RETURN NEW; END IF;

    -- 1. Get current user count for this domain from profiles
    SELECT COUNT(*) INTO current_count
    FROM public.profiles
    WHERE signup_domain = user_domain;

    -- 2. Get the assigned limit for this domain
    SELECT user_limit INTO max_limit
    FROM public.tenant_limits
    WHERE domain = user_domain;

    -- Default limit logic if not found in table
    IF max_limit IS NULL THEN
        max_limit := 10; -- Default conservative limit
    END IF;

    -- 3. Check Condition
    IF current_count >= max_limit THEN
        RAISE EXCEPTION 'Signup Limit Reached: This workspace (%s) is limited to % users.', user_domain, max_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach this check filter to the BEFORE INSERT trigger on PROFILES
-- Important: We attach it to PROFILES trigger because we control that table.
-- When auth.users triggers 'handle_new_user', that function INSERTS into 'profiles'.
-- We intercept THAT insert.

DROP TRIGGER IF EXISTS check_limit_before_profile_insert ON public.profiles;

CREATE TRIGGER check_limit_before_profile_insert
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tenant_limit();

-- 5. Seed initial data (Example)
INSERT INTO public.tenant_limits (domain, user_limit) VALUES 
('clickube.com', 10000), 
('chatmat.in', 50)
ON CONFLICT (domain) DO UPDATE SET user_limit = EXCLUDED.user_limit;
