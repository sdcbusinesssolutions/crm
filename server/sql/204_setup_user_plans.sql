
-- =================================================================
-- USER SUBSCRIPTION PLANS & EXPIRY NOTIFICATIONS
-- Description: Manage per-user plans and notification logic.
-- =================================================================

-- 1. Add subscription columns to public.profiles
-- We use ALTER TABLE to add these columns safely if they don't exist.
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

-- 2. Function to check User Plan Status (Login Check)
-- This runs on login to Block expired users.
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
             -- If < 10 days, we return a warning message but allow login
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
-- Similar logic but for the Tenant, used by Admin Dashboard
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
