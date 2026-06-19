-- =================================================================
-- MIGRATION 213: SIGNUP FIELDS & WHATSAPP NOTIFICATIONS
-- =================================================================

-- 1. Add name and contact_number to public.profiles
DO $$
BEGIN
    BEGIN
        ALTER TABLE public.profiles ADD COLUMN name TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;

    BEGIN
        ALTER TABLE public.profiles ADD COLUMN contact_number TEXT;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- 2. Update handle_new_user() trigger to extract name and contact_number
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_data JSONB;
    s_domain  TEXT;
    u_name    TEXT;
    u_contact TEXT;
    trial_days INTEGER := 7; 
BEGIN
    user_data := to_jsonb(new);

    -- Extract signup_domain from user metadata
    s_domain := COALESCE(
        (user_data->'raw_user_meta_data'->>'signup_domain'),
        (user_data->'user_metadata'->>'signup_domain'),
        'unknown'
    );
    
    u_name := COALESCE(
        (user_data->'raw_user_meta_data'->>'name'),
        (user_data->'user_metadata'->>'name'),
        ''
    );
    
    u_contact := COALESCE(
        (user_data->'raw_user_meta_data'->>'contact_number'),
        (user_data->'user_metadata'->>'contact_number'),
        ''
    );

    INSERT INTO public.profiles (
        id,
        email,
        name,
        contact_number,
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
        u_name,
        u_contact,
        s_domain,
        'user',
        'Free Trial',                            
        'active',                                
        NOW() + (trial_days || ' days')::INTERVAL, 
        FALSE                                    
    );

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Create public.tenant_notification_settings
CREATE TABLE IF NOT EXISTS public.tenant_notification_settings (
    domain TEXT PRIMARY KEY,
    integration_user_email TEXT,
    whatsapp_waba_id TEXT,
    whatsapp_api_number_id TEXT,
    admin_whatsapp_number TEXT,
    admin_whatsapp_template_name TEXT,
    admin_whatsapp_template_params JSONB,
    admin_whatsapp_media_url TEXT,
    notify_admin_on_signup BOOLEAN DEFAULT FALSE,
    send_welcome_whatsapp BOOLEAN DEFAULT FALSE,
    welcome_template_name TEXT,
    welcome_template_params JSONB,
    welcome_template_media_url TEXT,
    
    notify_admin_via_email BOOLEAN DEFAULT FALSE,
    admin_email_address TEXT,
    send_welcome_email BOOLEAN DEFAULT FALSE,
    welcome_email_subject TEXT,
    welcome_email_body TEXT,
    
    trigger_webhook_on_signup BOOLEAN DEFAULT FALSE,
    admin_webhook_url TEXT,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Enable RLS and Policies for tenant_notification_settings
ALTER TABLE public.tenant_notification_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow public read of tenant_notification_settings' AND tablename = 'tenant_notification_settings'
    ) THEN
        CREATE POLICY "Allow public read of tenant_notification_settings" ON public.tenant_notification_settings FOR SELECT USING (true);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access tenant_notification_settings' AND tablename = 'tenant_notification_settings'
    ) THEN
        CREATE POLICY "Service role full access tenant_notification_settings" ON public.tenant_notification_settings FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- 5. IMPORTANT: Reload Supabase Schema Cache
NOTIFY pgrst, 'reload schema';
