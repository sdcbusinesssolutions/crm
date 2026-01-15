-- =================================================================
-- COMBINED MULTI-TENANCY SETUP SCRIPT
-- =================================================================
-- This script consolidates the following features:
-- 1. Base Multi-Tenancy (Profiles & Triggers)
-- 2. Tenant Limits & Quotas
-- 3. Tenant Plans & Subscription Check (overwrites legacy checks)
-- 4. User Plans & Notifications
-- 5. Domain Branding (White-Labeling)
-- 6. Super Admin Dashboard RPCs
-- =================================================================

-- =================================================================
-- SECTION 1: BASE MULTI-TENANCY
-- Source: 200_setup_multi_tenancy.sql
-- =================================================================

-- 1. Create a public profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    signup_domain TEXT, -- The domain they registered on (e.g. 'chatmat.in')
    role TEXT DEFAULT 'user', -- 'admin', 'user', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy A: Users can view their own profile
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own profile' AND tablename = 'profiles'
    ) THEN
        CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
    END IF;
END $$;

-- Policy B: Service Role (Server) can do anything
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'profiles'
    ) THEN
        CREATE POLICY "Service role full access" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Create a Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    user_data JSONB;
    s_domain TEXT;
BEGIN
    -- Convert NEW record to JSONB to safely check for column existence
    user_data := to_jsonb(new);
    
    -- Try to find signup_domain in raw_user_meta_data OR user_metadata
    -- This handles different Supabase versions or schema variations
    s_domain := COALESCE(
        (user_data->'raw_user_meta_data'->>'signup_domain'), 
        (user_data->'user_metadata'->>'signup_domain'),
        'unknown'
    );

    INSERT INTO public.profiles (id, email, signup_domain, role)
    VALUES (
        new.id, 
        new.email, 
        s_domain,
        'user'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger the function every time a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill existing users (Optional - Safe to run)
-- Commented out to prevent failure if column names vary across Supabase versions
/*
INSERT INTO public.profiles (id, email, signup_domain)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'signup_domain', 'legacy_user')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
*/


-- =================================================================
-- SECTION 2: TENANT LIMITS & QUOTAS
-- Source: 202_setup_tenant_limits.sql
-- =================================================================

-- 1. Create table for Tenant Limits
CREATE TABLE IF NOT EXISTS public.tenant_limits (
    domain TEXT PRIMARY KEY,
    user_limit INTEGER DEFAULT 10,  -- Default limit if not specified
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.tenant_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read of limits' AND tablename = 'tenant_limits'
    ) THEN
        CREATE POLICY "Allow public read of limits" ON public.tenant_limits FOR SELECT USING (true);
    END IF;
END $$;

-- 3. Function to check limit before user creation
CREATE OR REPLACE FUNCTION public.check_tenant_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_limit INTEGER;
    user_domain TEXT;
    user_data JSONB;
BEGIN
    user_data := to_jsonb(new);
    
    user_domain := COALESCE(
        new.signup_domain, 
        (user_data->'raw_user_meta_data'->>'signup_domain'), 
        (user_data->'user_metadata'->>'signup_domain'), 
        'unknown'
    );

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
DROP TRIGGER IF EXISTS check_limit_before_profile_insert ON public.profiles;

CREATE TRIGGER check_limit_before_profile_insert
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.check_tenant_limit();

-- 5. Seed initial data
INSERT INTO public.tenant_limits (domain, user_limit) VALUES 
('clickube.com', 10000), 
('chatmat.in', 50)
ON CONFLICT (domain) DO UPDATE SET user_limit = EXCLUDED.user_limit;


-- =================================================================
-- SECTION 3: TENANT SUBSCRIPTION PLANS
-- Source: 203_setup_tenant_plans.sql
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read of plans' AND tablename = 'tenant_plans'
    ) THEN
        CREATE POLICY "Allow public read of plans" ON public.tenant_plans FOR SELECT USING (true);
    END IF;
END $$;

-- 3. check_admin_status function (Includes PLAN check + MANUAL BAN check)
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

    -- If no plan record exists, assume they are on a trial or default active
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

-- 4. Seed initial data
INSERT INTO public.tenant_plans (domain, plan_name, status, expires_at) VALUES 
('clickube.com', 'Enterprise', 'active', '2099-12-31'), 
('chatmat.in', 'Pro', 'active', NOW() + INTERVAL '30 days')
ON CONFLICT (domain) DO UPDATE SET 
    status = EXCLUDED.status,
    expires_at = EXCLUDED.expires_at;


-- =================================================================
-- SECTION 4: USER PLANS & NOTIFICATIONS
-- Source: 204_setup_user_plans.sql
-- =================================================================

-- 1. Add subscription columns to public.profiles
DO $$ 
BEGIN 
    BEGIN    
        ALTER TABLE public.profiles ADD COLUMN plan_name TEXT DEFAULT 'Free';
        ALTER TABLE public.profiles ADD COLUMN plan_status TEXT DEFAULT 'active';
        ALTER TABLE public.profiles ADD COLUMN plan_expires_at TIMESTAMPTZ;
        ALTER TABLE public.profiles ADD COLUMN last_notification_sent_at TIMESTAMPTZ;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- 2. Function to check User Plan Status
CREATE OR REPLACE FUNCTION public.check_user_plan_status(target_user_id UUID)
RETURNS TABLE(is_allowed BOOLEAN, message TEXT, days_left INTEGER) 
SECURITY DEFINER
AS $$
DECLARE
    u_status TEXT;
    u_expires TIMESTAMPTZ;
    days_remaining INTEGER;
BEGIN
    SELECT plan_status, plan_expires_at INTO u_status, u_expires
    FROM public.profiles
    WHERE id = target_user_id;

    -- If no plan info, assume default active (User Friendly)
    IF u_status IS NULL THEN
        RETURN QUERY SELECT true, 'OK', 999;
        RETURN;
    END IF;

    -- Check Suspended
    IF u_status != 'active' THEN
        RETURN QUERY SELECT false, 'Your subscription is ' || u_status, 0;
        RETURN;
    END IF;

    -- Check Expiry
    IF u_expires IS NOT NULL THEN
        IF u_expires < NOW() THEN
             RETURN QUERY SELECT false, 'Your subscription expired on ' || TO_CHAR(u_expires, 'YYYY-MM-DD'), 0;
             RETURN;
        ELSE
             -- Calculate days remaining
             days_remaining := EXTRACT(DAY FROM (u_expires - NOW()))::INTEGER;
             
             -- NOTIFICATION LOGIC (Soft Check)
             IF days_remaining <= 10 THEN
                  RETURN QUERY SELECT true, 'PLAN_EXPIRING_SOON', days_remaining;
             ELSE
                  RETURN QUERY SELECT true, 'OK', days_remaining;
             END IF;
        END IF;
    END IF;

    RETURN QUERY SELECT true, 'OK', 999;
END;
$$ LANGUAGE plpgsql;

-- 3. Function to check Tenant Plan Status (Notification Check)
CREATE OR REPLACE FUNCTION public.check_tenant_plan_notification(check_domain TEXT)
RETURNS TABLE(days_left INTEGER, message TEXT) 
SECURITY DEFINER
AS $$
DECLARE
    t_expires TIMESTAMPTZ;
    t_status TEXT;
    days_remaining INTEGER;
BEGIN
    SELECT expires_at, status INTO t_expires, t_status
    FROM public.tenant_plans
    WHERE domain = check_domain;

    IF t_expires IS NOT NULL AND t_status = 'active' THEN
         days_remaining := EXTRACT(DAY FROM (t_expires - NOW()))::INTEGER;
         
         IF days_remaining <= 10 AND days_remaining >= 0 THEN
             RETURN QUERY SELECT days_remaining, 'Your Workspace Plan expires in ' || days_remaining || ' days. Please renew.';
         ELSE
             RETURN QUERY SELECT days_remaining, 'OK';
         END IF;
    ELSE
         RETURN QUERY SELECT 999, 'OK';
    END IF;
END;
$$ LANGUAGE plpgsql;


-- =================================================================
-- SECTION 5: DOMAIN BRANDING & SETTINGS
-- Source: 205_setup_branding.sql
-- =================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.domain_settings (
    domain TEXT PRIMARY KEY,
    brand_name TEXT DEFAULT 'My Platform',
    logo_url TEXT, -- URL to image
    favicon_url TEXT,
    primary_color TEXT DEFAULT '#2563eb', -- Default Blue
    secondary_color TEXT DEFAULT '#1e40af',
    support_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.domain_settings ENABLE ROW LEVEL SECURITY;

-- 3. Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read of settings' AND tablename = 'domain_settings'
    ) THEN
        CREATE POLICY "Allow public read of settings" ON public.domain_settings FOR SELECT USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access' AND tablename = 'domain_settings'
    ) THEN
        CREATE POLICY "Service role full access" ON public.domain_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 4. Seed Data
INSERT INTO public.domain_settings (domain, brand_name, primary_color, support_email) VALUES
('clickube.com', 'ClicKube', '#ea580c', 'support@clickube.com'), 
('chatmat.in', 'ChatMat', '#16a34a', 'help@chatmat.in')        
ON CONFLICT (domain) DO NOTHING;


-- =================================================================
-- SECTION 6: SUPER ADMIN DASHBOARD
-- Source: 206_setup_super_dashboard.sql
-- =================================================================

-- 1. Create RPC for Super Admin to Fetch All Tenants
CREATE OR REPLACE FUNCTION public.get_all_tenants_summary()
RETURNS TABLE(
    domain TEXT,
    brand_name TEXT,
    user_count BIGINT,
    user_limit INTEGER,
    plan_name TEXT,
    plan_status TEXT,
    plan_expires_at TIMESTAMPTZ,
    admin_email TEXT
) 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.domain,
        COALESCE(ds.brand_name, 'Unknown'),
        (SELECT COUNT(*) FROM public.profiles p WHERE p.signup_domain = ds.domain),
        COALESCE(tl.user_limit, 10),
        COALESCE(tp.plan_name, 'Free'),
        COALESCE(tp.status, 'active'),
        tp.expires_at,
        ('Admin@' || ds.domain)
    FROM public.domain_settings ds
    LEFT JOIN public.tenant_limits tl ON ds.domain = tl.domain
    LEFT JOIN public.tenant_plans tp ON ds.domain = tp.domain;
END;
$$ LANGUAGE plpgsql;

-- END OF COMBINED SCRIPT
