


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer DEFAULT 10, "plan_name" "text" DEFAULT 'Free'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    caller_role TEXT;
BEGIN
    -- 1. Security Check: Only Super Admin
    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();
    
    IF caller_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Super Admins can add tenants.';
    END IF;

    -- 2. Normalize Domain
    new_domain := lower(trim(new_domain));

    -- 3. Insert into Domain Settings (Branding)
    INSERT INTO public.domain_settings (domain, brand_name)
    VALUES (new_domain, INITCAP(SPLIT_PART(new_domain, '.', 1)))
    ON CONFLICT (domain) DO NOTHING;

    -- 4. Insert into Tenant Limits
    INSERT INTO public.tenant_limits (domain, user_limit)
    VALUES (new_domain, initial_limit)
    ON CONFLICT (domain) DO UPDATE SET user_limit = EXCLUDED.user_limit;

    -- 5. Insert into Tenant Plans
    INSERT INTO public.tenant_plans (domain, plan_name, status, expires_at)
    VALUES (new_domain, plan_name, 'active', NOW() + INTERVAL '30 days')
    ON CONFLICT (domain) DO NOTHING;

END;
$$;


ALTER FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET status = 'aborted',
        last_interaction_at = NOW()
    WHERE contact_phone = p_contact_phone
      AND (status = 'active' OR status = 'waiting_input');
END;
$$;


ALTER FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_status"("check_domain" "text") RETURNS TABLE("is_banned" boolean, "fail_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."check_admin_status"("check_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_tenant_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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
$$;


ALTER FUNCTION "public"."check_tenant_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") RETURNS TABLE("days_left" integer, "message" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") RETURNS TABLE("is_allowed" boolean, "message" "text", "days_left" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
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
$$;


ALTER FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result JSONB;
    v_id UUID;
BEGIN
    INSERT INTO flow_sessions (user_id, contact_phone, flow_id, current_node_id, status, variables)
    VALUES (p_user_id, p_contact_phone, p_flow_id, p_current_node_id, 'active', p_variables)
    RETURNING id INTO v_id;

    SELECT to_jsonb(fs.*) INTO v_result FROM flow_sessions fs WHERE id = v_id;
    RETURN v_result;
END;
$$;


ALTER FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_tenant"("target_domain" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
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

    -- Prevent deleting the master domain
    IF target_domain = 'clickube.com' THEN
        RAISE EXCEPTION 'Cannot delete the Master Tenant (clickube.com).';
    END IF;

    -- 2. Delete Tenant Data
    DELETE FROM public.tenant_limits WHERE domain = target_domain;
    DELETE FROM public.tenant_plans WHERE domain = target_domain;
    DELETE FROM public.onboarding_settings WHERE domain = target_domain;
    DELETE FROM public.profiles WHERE signup_domain = target_domain;

    RETURN jsonb_build_object('success', true, 'message', 'Tenant deleted.');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;


ALTER FUNCTION "public"."delete_tenant"("target_domain" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.user_id, f.name, f.nodes, f.edges, f.status
    FROM flows f
    WHERE f.nodes @> ('[{"data": {"webhookId": "' || p_webhook_id || '"}}]')::jsonb;
END;
$$;


ALTER FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_form_token"() RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_token := encode(gen_random_bytes(6), 'base64');
    v_token := replace(replace(replace(v_token, '/', ''), '+', ''), '=', '');
    v_token := substring(v_token, 1, 8);
    
    SELECT EXISTS(SELECT 1 FROM public.forms WHERE form_token = v_token) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."generate_form_token"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_owner_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM public.team_members
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
    RETURN COALESCE(v_owner_id, auth.uid());
END;
$$;


ALTER FUNCTION "public"."get_active_owner_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_active_session"("p_contact_phone" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "contact_phone" "text", "flow_id" "uuid", "current_node_id" "text", "status" "text", "variables" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT fs.id, fs.user_id, fs.contact_phone, fs.flow_id, fs.current_node_id, fs.status, fs.variables, fs.created_at, fs.last_interaction_at
    FROM flow_sessions fs
    WHERE fs.contact_phone = p_contact_phone
      AND fs.status = 'waiting_input'
    ORDER BY fs.created_at DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_active_session"("p_contact_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_tenants_summary"() RETURNS TABLE("domain" "text", "brand_name" "text", "user_count" bigint, "user_limit" integer, "plan_name" "text", "plan_status" "text", "plan_expires_at" timestamp with time zone, "admin_email" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    caller_role TEXT;
    caller_uid UUID;
BEGIN
    caller_uid := auth.uid();
    
    SELECT role INTO caller_role
    FROM public.profiles
    WHERE id = caller_uid;

    RAISE NOTICE 'get_all_tenants_summary called by: % (Role: %)', caller_uid, caller_role;

    -- SECURITY CHECK
    IF LOWER(TRIM(BOTH FROM COALESCE(caller_role, ''))) IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Access Denied: Super Admin role required. Your role: %', COALESCE(caller_role, 'None');
    END IF;

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
$$;


ALTER FUNCTION "public"."get_all_tenants_summary"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text", "trigger_keywords" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.id = p_flow_id;
END;
$$;


ALTER FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text", "trigger_keywords" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.user_id = p_user_id
      -- Check status case-insensitively (Published, published, PUBLISHED)
      AND LOWER(f.status) = 'published'
      -- Check keyword containment
      AND f.trigger_keywords @> ARRAY[LOWER(p_keyword)];
END;
$$;


ALTER FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") RETURNS TABLE("raw_payload" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT wl.raw_payload, wl.created_at
    FROM public.webhook_logs wl
    WHERE wl.webhook_id = p_webhook_id
    ORDER BY wl.created_at DESC
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_ids"() RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid()
  );
END;
$$;


ALTER FUNCTION "public"."get_my_org_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_tenant_stats"() RETURNS TABLE("user_count" bigint, "user_limit" integer, "plan_name" "text", "days_left" integer)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    my_domain TEXT;
    my_limit INTEGER;
    my_plan TEXT;
    my_expiry TIMESTAMPTZ;
    my_count BIGINT;
BEGIN
    -- 1. Get Current User's Domain
    SELECT signup_domain INTO my_domain
    FROM public.profiles
    WHERE id = auth.uid();

    -- 2. Get Limit
    SELECT t.user_limit INTO my_limit
    FROM public.tenant_limits t
    WHERE t.domain = my_domain;

    -- Default if missing
    IF my_limit IS NULL THEN my_limit := 10; END IF;

    -- 3. Get Plan Info
    SELECT p.plan_name, p.expires_at INTO my_plan, my_expiry
    FROM public.tenant_plans p
    WHERE p.domain = my_domain;

    -- Default Plan
    IF my_plan IS NULL THEN my_plan := 'Free'; END IF;

    -- 4. Get User Count (Dynamic)
    SELECT COUNT(*) INTO my_count
    FROM public.profiles
    WHERE signup_domain = my_domain;

    -- 5. Calculate Days Left
    IF my_expiry IS NOT NULL THEN
        days_left := EXTRACT(DAY FROM (my_expiry - NOW()))::INTEGER;
    ELSE
        days_left := 999;
    END IF;

    RETURN QUERY SELECT 
        my_count, 
        my_limit, 
        my_plan, 
        days_left;
END;
$$;


ALTER FUNCTION "public"."get_my_tenant_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_schema_deep_info"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'tables', (
            SELECT jsonb_object_agg(table_name, columns)
            FROM (
                SELECT 
                    table_name,
                    jsonb_object_agg(column_name, data_type) as columns
                FROM information_schema.columns
                WHERE table_schema = 'public'
                GROUP BY table_name
            ) t
        ),
        'policies', (
            SELECT jsonb_agg(jsonb_build_object(
                'schema', schemaname,
                'table', tablename,
                'policy_name', policyname,
                'cmd', cmd,
                'roles', roles
            ))
            FROM pg_policies
            WHERE schemaname IN ('public', 'storage') 
              AND (tablename NOT LIKE 'migrations%' AND tablename != 'schema_migrations')
        ),
        'triggers', (
            SELECT jsonb_agg(jsonb_build_object(
                'trigger_name', trigger_name,
                'table', event_object_table,
                'event', event_manipulation
            ))
            FROM information_schema.triggers
            WHERE trigger_schema = 'public'
        ),
        'functions', (
            SELECT jsonb_agg(jsonb_build_object(
                'name', p.proname,
                'args', pg_get_function_arguments(p.oid)
            ))
            FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public'
        )
    ) INTO result;

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_schema_deep_info"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT verify_token INTO v_token
  FROM public.whatsapp_config
  WHERE user_id = p_user_id AND phone_number_id = p_phone_number_id
  LIMIT 1;
  
  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_config JSONB;
BEGIN
    IF p_phone_number_id IS NOT NULL THEN
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        AND wc.phone_number_id = p_phone_number_id
        LIMIT 1;
    ELSE
        -- If no phone number ID provided, return the first one found for the user
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        LIMIT 1;
    END IF;

    RETURN v_config;
END;
$$;


ALTER FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_filename" "text" DEFAULT NULL::"text", "p_mime_type" "text" DEFAULT NULL::"text", "p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_timestamp" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_conversation_id UUID;
    v_conversation_unread_count INTEGER;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id, unread_count INTO v_conversation_id, v_conversation_unread_count
    FROM public.conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (
            user_id,
            contact_phone,
            contact_name,
            last_message,
            unread_count,
            status,
            updated_at
        ) VALUES (
            p_user_id,
            p_contact_phone,
            p_contact_name,
            COALESCE(p_message_text, '[' || p_message_type || ']'),
            1,
            'open',
            NOW()
        ) RETURNING id INTO v_conversation_id;
    ELSE
        UPDATE public.conversations
        SET last_message = COALESCE(p_message_text, '[' || p_message_type || ']'),
            unread_count = COALESCE(v_conversation_unread_count, 0) + 1,
            updated_at = NOW()
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO public.messages (
        conversation_id,
        type,
        text,
        media_url,
        filename,
        mime_type,
        latitude,
        longitude,
        direction,
        status,
        created_at
    ) VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        p_filename,
        p_mime_type,
        p_latitude,
        p_longitude,
        'in',
        'delivered',
        p_timestamp
    ) RETURNING id INTO v_message_id;

    RETURN jsonb_build_object(
        'conversation_id', v_conversation_id,
        'message_id', v_message_id
    );
END;
$$;


ALTER FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE campaigns
  SET failed_count = failed_count + 1
  WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_campaign_success"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  UPDATE campaigns
  SET success_count = success_count + 1
  WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_campaign_success"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_lead_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  IF (OLD.stage_id IS DISTINCT FROM NEW.stage_id) THEN
    INSERT INTO public.lead_events (
      lead_id,
      org_id,
      event_type,
      event_data,
      previous_value,
      new_value,
      triggered_by
    ) VALUES (
      NEW.id,
      NEW.org_id,
      'stage_changed',
      jsonb_build_object(
        'previous_stage_id', OLD.stage_id,
        'new_stage_id', NEW.stage_id,
        'pipeline_id', NEW.pipeline_id
      ),
      OLD.stage_id::TEXT,
      NEW.stage_id::TEXT,
      auth.uid()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_lead_stage_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'sent'::"text", "p_whatsapp_message_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_conversation_id UUID;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (user_id, contact_phone, status, unread_count, last_message, updated_at)
        VALUES (p_user_id, p_contact_phone, 'open', 0, 'Outbound Message', NOW())
        RETURNING id INTO v_conversation_id;
    ELSE
        -- Update conversation timestamp
        UPDATE conversations
        SET updated_at = NOW(),
            last_message = COALESCE(p_message_text, 'Sent ' || p_message_type)
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO messages (
        conversation_id,
        type,
        text,
        media_url,
        direction,
        status,
        whatsapp_message_id,
        created_at
    )
    VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        'out',
        p_status,
        p_whatsapp_message_id,
        NOW()
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;


ALTER FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text" DEFAULT 'pending'::"text", "p_message_type" "text" DEFAULT NULL::"text", "p_sender_phone" "text" DEFAULT NULL::"text", "p_webhook_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
    INSERT INTO public.webhook_logs (
        user_id,
        phone_number_id,
        http_method,
        raw_payload,
        processed_status,
        message_type,
        sender_phone,
        webhook_id,
        created_at
    ) VALUES (
        p_user_id,
        p_phone_number_id,
        p_http_method,
        p_raw_payload,
        p_processed_status,
        p_message_type,
        p_sender_phone,
        p_webhook_id,
        NOW()
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;


ALTER FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text" DEFAULT NULL::"text", "p_pipeline_id" "uuid" DEFAULT NULL::"uuid", "p_stage_id" "uuid" DEFAULT NULL::"uuid", "p_owner_id" "uuid" DEFAULT NULL::"uuid", "p_tags" "text"[] DEFAULT NULL::"text"[], "p_status" "text" DEFAULT NULL::"text", "p_limit" integer DEFAULT 50, "p_offset" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "name" "text", "email" "text", "phone" "text", "company" "text", "pipeline_id" "uuid", "stage_id" "uuid", "owner_id" "uuid", "tags" "text"[], "status" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.name,
    l.email,
    l.phone,
    l.company,
    l.pipeline_id,
    l.stage_id,
    l.owner_id,
    l.tags,
    l.status,
    l.created_at
  FROM public.leads l
  WHERE l.org_id = p_org_id
    AND (p_search_text IS NULL OR l.search_vector @@ plainto_tsquery('english', p_search_text))
    AND (p_pipeline_id IS NULL OR l.pipeline_id = p_pipeline_id)
    AND (p_stage_id IS NULL OR l.stage_id = p_stage_id)
    AND (p_owner_id IS NULL OR l.owner_id = p_owner_id)
    AND (p_tags IS NULL OR l.tags && p_tags)
    AND (p_status IS NULL OR l.status = p_status)
  ORDER BY l.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;


ALTER FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text" DEFAULT NULL::"text", "p_user_agent" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_form RECORD;
    v_contact_id UUID;
    v_lead_id UUID;
    v_submission_id UUID;
    v_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_company TEXT;
    v_tags TEXT[];
    v_group_ids TEXT[];
BEGIN
    -- Get Form
    SELECT * INTO v_form
    FROM public.forms
    WHERE form_token = p_form_token AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Form not found or inactive';
    END IF;

    -- Extract fields
    v_name := p_submission_data->>'name';
    v_email := p_submission_data->>'email';
    v_phone := p_submission_data->>'phone';
    v_company := p_submission_data->>'company';

    -- Extract tags and groups from settings
    -- Use COALESCE to handle nulls and ensure array type
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_tags') = 'array' 
                THEN v_form.settings->'default_tags' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_tags;

    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_group_ids') = 'array' 
                THEN v_form.settings->'default_group_ids' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_group_ids;

    -- Create Contact
    INSERT INTO public.contacts (
        user_id, name, email, phone, status, source, tags, group_ids, custom_data
    ) VALUES (
        v_form.user_id,
        COALESCE(v_name, 'Unknown'),
        v_email,
        v_phone,
        'New',
        'Web Form',
        v_tags,
        v_group_ids,
        p_submission_data
    ) RETURNING id INTO v_contact_id;

    -- Create Lead
    IF v_form.pipeline_id IS NOT NULL THEN
        INSERT INTO public.leads (
            user_id, pipeline_id, stage_id, name, email, phone, company, custom_data, source, status
        ) VALUES (
            v_form.user_id,
            v_form.pipeline_id,
            v_form.stage_id,
            COALESCE(v_name, 'Unknown'),
            v_email,
            v_phone,
            v_company,
            p_submission_data,
            'web_form',
            'active'
        ) RETURNING id INTO v_lead_id;
    END IF;

    -- Create Submission
    INSERT INTO public.form_submissions (
        form_id, lead_id, submission_data, ip_address, user_agent
    ) VALUES (
        v_form.id,
        v_lead_id,
        p_submission_data,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_submission_id;

    -- Update Count
    UPDATE public.forms
    SET submission_count = submission_count + 1
    WHERE id = v_form.id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'lead_id', v_lead_id,
        'contact_id', v_contact_id,
        'message', v_form.success_message
    );
END;
$$;


ALTER FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_flow_keywords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    keywords text[];
BEGIN
    -- Extract 'keywords' from 'onMessage' nodes
    SELECT ARRAY_AGG(DISTINCT LOWER(k))
    INTO keywords
    FROM jsonb_array_elements(NEW.nodes) AS n(data),
         jsonb_array_elements_text(n.data->'data'->'keywords') AS k
    WHERE n.data->>'type' = 'onMessage';

    -- Update the dedicated column
    NEW.trigger_keywords := COALESCE(keywords, '{}');
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_flow_keywords"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- 1. Update Messages Table (Chat History)
    -- We want to return TRUE only if a row was actually updated.
    -- PostgreSQL UPDATE returns the number of rows affected, checking FOUND is correct after an update.
    UPDATE public.messages
    SET status = p_status,
        updated_at = NOW()
    WHERE whatsapp_message_id = p_whatsapp_message_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Update Campaign Queue (Campaign Stats)
    -- Only updates if the message ID exists in the queue (i.e. it was sent via campaign)
    UPDATE public.campaign_queue
    SET status = UPPER(p_status), -- Campaign queue uses uppercase (SENT, DELIVERED, READ)
        updated_at = NOW()
    WHERE message_id = p_whatsapp_message_id;

    RETURN TRUE;
END;
$$;


ALTER FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET status = p_status,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET current_node_id = p_current_node_id,
        status = p_status,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;


ALTER FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET variables = p_variables,
        last_interaction_at = NOW()
    WHERE id = p_session_id;

    -- If no row was updated, it might mean the session is gone or ID is wrong.
    -- We could raise notice or error, but void is fine for now.
END;
$$;


ALTER FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
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
$$;


ALTER FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text" DEFAULT NULL::"text", "p_sender_phone" "text" DEFAULT NULL::"text", "p_extracted_content" "jsonb" DEFAULT NULL::"jsonb", "p_error_message" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.webhook_logs
  SET 
    processed_status = p_processed_status,
    message_type = p_message_type,
    sender_phone = p_sender_phone,
    extracted_content = p_extracted_content,
    error_message = p_error_message,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_log_id;
END;
$$;


ALTER FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."appointments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "start_time" timestamp without time zone NOT NULL,
    "end_time" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "status" "text" DEFAULT 'scheduled'::"text"
);


ALTER TABLE "public"."appointments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."branding_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "theme_config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."branding_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."call_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "call_type" character varying(50) NOT NULL,
    "duration" integer DEFAULT 0,
    "notes" "text",
    "called_at" timestamp without time zone DEFAULT "now"(),
    "created_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."call_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_queue" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid",
    "contact_id" "uuid",
    "phone_number" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text",
    "message_id" "text",
    "error_message" "text",
    "sent_at" timestamp with time zone,
    "retry_count" integer DEFAULT 0,
    "next_retry_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_queue" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "title" "text" NOT NULL,
    "template_id" "uuid",
    "template_name" "text",
    "language_code" "text",
    "contact_group_id" "uuid",
    "scheduled_at" timestamp with time zone,
    "variable_mapping" "jsonb",
    "status" "text" DEFAULT 'SCHEDULED'::"text",
    "total_contacts" integer DEFAULT 0,
    "success_count" integer DEFAULT 0,
    "failed_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "media_url" "text",
    "media_type" "text",
    "location_header" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_groups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "description" "text",
    "status" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "org_id" "uuid"
);


ALTER TABLE "public"."contact_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "phone" "text",
    "email" "text",
    "status" "text",
    "source" "text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "group_ids" "text"[] DEFAULT '{}'::"text"[],
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "last_active" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_phone" "text" NOT NULL,
    "contact_name" "text",
    "last_message" "text",
    "unread_count" integer DEFAULT 0,
    "status" "text" DEFAULT 'open'::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "assigned_to" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_fields" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text",
    "type" "text",
    "placeholder" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."custom_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."domain_settings" (
    "domain" "text" NOT NULL,
    "brand_name" "text" DEFAULT 'My Platform'::"text",
    "logo_url" "text",
    "favicon_url" "text",
    "primary_color" "text" DEFAULT '#2563eb'::"text",
    "secondary_color" "text" DEFAULT '#1e40af'::"text",
    "support_email" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."domain_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flow_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "contact_phone" "text" NOT NULL,
    "flow_id" "uuid",
    "current_node_id" "text",
    "status" "text" DEFAULT 'active'::"text",
    "variables" "jsonb" DEFAULT '{}'::"jsonb",
    "last_interaction_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."flow_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."flows" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" DEFAULT 'Untitled Flow'::"text" NOT NULL,
    "description" "text" DEFAULT 'No description'::"text",
    "status" "text" DEFAULT 'Draft'::"text",
    "nodes" "jsonb" DEFAULT '[]'::"jsonb",
    "edges" "jsonb" DEFAULT '[]'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "trigger_keywords" "text"[] DEFAULT '{}'::"text"[]
);


ALTER TABLE "public"."flows" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."form_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "form_id" "uuid" NOT NULL,
    "lead_id" "uuid",
    "submission_data" "jsonb" NOT NULL,
    "ip_address" "text",
    "user_agent" "text",
    "submitted_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."form_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."forms" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "name" character varying(255) NOT NULL,
    "description" "text",
    "form_token" character varying(255) NOT NULL,
    "fields" "jsonb" DEFAULT '[]'::"jsonb",
    "settings" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "styling" "jsonb" DEFAULT '{}'::"jsonb",
    "success_message" "text" DEFAULT 'Thank you for your submission!'::"text",
    "submission_count" integer DEFAULT 0,
    "default_group_ids" "text"[] DEFAULT '{}'::"text"[],
    "default_tags" "text"[] DEFAULT '{}'::"text"[],
    "default_owner_id" "uuid",
    "success_redirect_url" "text",
    "last_submission_at" timestamp with time zone
);


ALTER TABLE "public"."forms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."integration_facebook_pages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "page_id" character varying(255) NOT NULL,
    "page_name" character varying(255),
    "page_access_token" "text" NOT NULL,
    "is_connected" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."integration_facebook_pages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pipeline_id" "uuid",
    "stage_id" "uuid",
    "name" character varying(255) NOT NULL,
    "email" character varying(255),
    "phone" character varying(50),
    "company" character varying(255),
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb",
    "status" character varying(50) DEFAULT 'active'::character varying,
    "priority" character varying(50) DEFAULT 'medium'::character varying,
    "estimated_value" numeric(10,2),
    "source" character varying(100) DEFAULT 'manual'::character varying,
    "type" character varying(50) DEFAULT 'Lead'::character varying,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "text" "text",
    "media_url" "text",
    "filename" "text",
    "mime_type" "text",
    "latitude" double precision,
    "longitude" double precision,
    "direction" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "whatsapp_message_id" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    CONSTRAINT "messages_direction_check" CHECK (("direction" = ANY (ARRAY['in'::"text", 'out'::"text"])))
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."meta_limits" (
    "id" bigint NOT NULL,
    "user_id" "uuid",
    "waba_id" "text" NOT NULL,
    "tier" "text",
    "daily_limit" integer,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."meta_limits" OWNER TO "postgres";


ALTER TABLE "public"."meta_limits" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."meta_limits_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."notes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255),
    "content" "text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."onboarding_settings" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "text" NOT NULL,
    "manual_enabled" boolean DEFAULT false,
    "embedded_enabled" boolean DEFAULT false,
    "embedded_app_id" "text",
    "embedded_app_secret" "text",
    "embedded_config_id" "text",
    "bridge_domain" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "domain" "text" DEFAULT 'clickube.com'::"text"
);


ALTER TABLE "public"."onboarding_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline_stages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#6b7280'::"text",
    "display_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."pipeline_stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipelines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(7) DEFAULT '#3b82f6'::character varying,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "is_default" boolean DEFAULT false
);


ALTER TABLE "public"."pipelines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plans" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT false,
    "limits" "jsonb" DEFAULT '{}'::"jsonb",
    "pricing" "jsonb" DEFAULT '[]'::"jsonb",
    "ai_bot_enabled" boolean DEFAULT false,
    "api_access_enabled" boolean DEFAULT false
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "signup_domain" "text",
    "role" "text" DEFAULT 'user'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "plan_name" "text" DEFAULT 'Free'::"text",
    "plan_status" "text" DEFAULT 'active'::"text",
    "plan_expires_at" timestamp with time zone,
    "last_notification_sent_at" timestamp with time zone
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sheet_automation_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "automation_id" "uuid",
    "row_data_hash" "text",
    "triggered_at" timestamp with time zone DEFAULT "now"(),
    "status" "text"
);


ALTER TABLE "public"."sheet_automation_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sheet_automations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "spreadsheet_id" "text" NOT NULL,
    "sheet_name" "text" NOT NULL,
    "automation_type" "text",
    "schedule_config" "jsonb",
    "trigger_condition" "jsonb",
    "template_config" "jsonb",
    "mapping_config" "jsonb",
    "status" "text" DEFAULT 'active'::"text",
    "last_run_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "sheet_automations_automation_type_check" CHECK (("automation_type" = ANY (ARRAY['schedule'::"text", 'new_row'::"text"])))
);


ALTER TABLE "public"."sheet_automations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "pipeline_id" "uuid" NOT NULL,
    "name" character varying(255) NOT NULL,
    "description" "text",
    "color" character varying(7) DEFAULT '#3b82f6'::character varying,
    "position" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"()
);


ALTER TABLE "public"."stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#6b7280'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" "text",
    "due_date" timestamp without time zone,
    "completed" boolean DEFAULT false,
    "created_at" timestamp without time zone DEFAULT "now"(),
    "updated_at" timestamp without time zone DEFAULT "now"(),
    "is_completed" boolean DEFAULT false,
    "reminder_sent" boolean DEFAULT false,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_members" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "email" "text" NOT NULL,
    "phone" "text",
    "role" "text" DEFAULT 'agent'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "last_login" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_limits" (
    "domain" "text" NOT NULL,
    "user_limit" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_plans" (
    "domain" "text" NOT NULL,
    "plan_name" "text" DEFAULT 'Free'::"text",
    "status" "text" DEFAULT 'active'::"text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."tenant_plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_integrations" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" NOT NULL,
    "connection_name" "text",
    "credentials" "jsonb",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_integrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_security" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "two_factor_secret" "text",
    "two_factor_enabled" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."user_security" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "user_id" "uuid" NOT NULL,
    "plan_id" "uuid",
    "start_date" timestamp with time zone,
    "end_date" timestamp with time zone,
    "status" "text" DEFAULT 'active'::"text",
    "payment_term" "text",
    "amount" numeric,
    "currency" "text" DEFAULT 'INR'::"text"
);


ALTER TABLE "public"."user_subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."webhook_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "http_method" "text" NOT NULL,
    "raw_payload" "jsonb",
    "processed_status" "text" DEFAULT 'pending'::"text",
    "message_type" "text",
    "sender_phone" "text",
    "extracted_content" "jsonb",
    "error_message" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "phone_number_id" "text",
    "webhook_id" "text"
);


ALTER TABLE "public"."webhook_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_config" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "phone_number" "text",
    "phone_number_id" "text",
    "whatsapp_business_account_id" "text",
    "meta_app_id" "text",
    "meta_access_token" "text",
    "verify_token" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "name" "text" DEFAULT 'WhatsApp Account'::"text",
    "access_token" "text"
);


ALTER TABLE "public"."whatsapp_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_flow_submissions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "flow_id" "text" NOT NULL,
    "flow_name" "text",
    "contact_phone" "text" NOT NULL,
    "contact_name" "text",
    "submission_data" "jsonb" NOT NULL,
    "submitted_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_flow_submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."whatsapp_templates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "language" "text" NOT NULL,
    "category" "text" NOT NULL,
    "template_type" "text" NOT NULL,
    "header_format" "text",
    "header_text" "text",
    "header_media_handle" "text",
    "body_text" "text" NOT NULL,
    "footer_text" "text",
    "buttons" "jsonb" DEFAULT '[]'::"jsonb",
    "status" "text" DEFAULT 'PENDING'::"text",
    "meta_template_id" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "quality_score" "text" DEFAULT 'UNKNOWN'::"text"
);


ALTER TABLE "public"."whatsapp_templates" OWNER TO "postgres";


ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branding_settings"
    ADD CONSTRAINT "branding_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."branding_settings"
    ADD CONSTRAINT "branding_settings_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_queue"
    ADD CONSTRAINT "campaign_queue_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contact_groups"
    ADD CONSTRAINT "contact_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_contact_phone_key" UNIQUE ("user_id", "contact_phone");



ALTER TABLE ONLY "public"."custom_fields"
    ADD CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."domain_settings"
    ADD CONSTRAINT "domain_settings_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flows"
    ADD CONSTRAINT "flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."form_submissions"
    ADD CONSTRAINT "form_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_form_token_key" UNIQUE ("form_token");



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_queue"
    ADD CONSTRAINT "idx_unique_campaign_phone" UNIQUE ("campaign_id", "phone_number");



ALTER TABLE ONLY "public"."integration_facebook_pages"
    ADD CONSTRAINT "integration_facebook_pages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."integration_facebook_pages"
    ADD CONSTRAINT "integration_facebook_pages_user_id_page_id_key" UNIQUE ("user_id", "page_id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_limits"
    ADD CONSTRAINT "meta_limits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."meta_limits"
    ADD CONSTRAINT "meta_limits_user_id_waba_id_key" UNIQUE ("user_id", "waba_id");



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_settings"
    ADD CONSTRAINT "onboarding_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."onboarding_settings"
    ADD CONSTRAINT "onboarding_settings_userid_domain_key" UNIQUE ("user_id", "domain");



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sheet_automation_logs"
    ADD CONSTRAINT "sheet_automation_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sheet_automations"
    ADD CONSTRAINT "sheet_automations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_name_key" UNIQUE ("user_id", "name");



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_limits"
    ADD CONSTRAINT "tenant_limits_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."tenant_plans"
    ADD CONSTRAINT "tenant_plans_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_user_id_provider_connection_name_key" UNIQUE ("user_id", "provider", "connection_name");



ALTER TABLE ONLY "public"."user_security"
    ADD CONSTRAINT "user_security_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_security"
    ADD CONSTRAINT "user_security_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_config"
    ADD CONSTRAINT "whatsapp_config_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_flow_submissions"
    ADD CONSTRAINT "whatsapp_flow_submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_appointments_lead_id" ON "public"."appointments" USING "btree" ("lead_id");



CREATE INDEX "idx_appointments_start_time" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_appointments_user_id" ON "public"."appointments" USING "btree" ("user_id");



CREATE INDEX "idx_call_logs_called_at" ON "public"."call_logs" USING "btree" ("called_at" DESC);



CREATE INDEX "idx_call_logs_lead_id" ON "public"."call_logs" USING "btree" ("lead_id");



CREATE INDEX "idx_call_logs_user_id" ON "public"."call_logs" USING "btree" ("user_id");



CREATE INDEX "idx_campaigns_scheduled" ON "public"."campaigns" USING "btree" ("user_id", "scheduled_at") WHERE ("scheduled_at" IS NOT NULL);



CREATE INDEX "idx_campaigns_user_id" ON "public"."campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_campaigns_user_status" ON "public"."campaigns" USING "btree" ("user_id", "status");



CREATE INDEX "idx_contact_groups_user_id" ON "public"."contact_groups" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_phone" ON "public"."contacts" USING "btree" ("phone");



CREATE INDEX "idx_contacts_user_created" ON "public"."contacts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_contacts_user_id" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_phone" ON "public"."conversations" USING "btree" ("user_id", "contact_phone");



CREATE INDEX "idx_custom_fields_user_id" ON "public"."custom_fields" USING "btree" ("user_id");



CREATE INDEX "idx_flow_sessions_active" ON "public"."flow_sessions" USING "btree" ("contact_phone", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_flows_keywords" ON "public"."flows" USING "gin" ("trigger_keywords");



CREATE INDEX "idx_flows_user_id" ON "public"."flows" USING "btree" ("user_id");



CREATE INDEX "idx_form_submissions_form_id" ON "public"."form_submissions" USING "btree" ("form_id");



CREATE INDEX "idx_form_submissions_lead_id" ON "public"."form_submissions" USING "btree" ("lead_id");



CREATE INDEX "idx_forms_form_token" ON "public"."forms" USING "btree" ("form_token");



CREATE INDEX "idx_forms_pipeline_id" ON "public"."forms" USING "btree" ("pipeline_id");



CREATE INDEX "idx_forms_token" ON "public"."forms" USING "btree" ("form_token");



CREATE INDEX "idx_forms_user_id" ON "public"."forms" USING "btree" ("user_id");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("email");



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");



CREATE INDEX "idx_leads_pipeline_id" ON "public"."leads" USING "btree" ("pipeline_id");



CREATE INDEX "idx_leads_stage_id" ON "public"."leads" USING "btree" ("stage_id");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_user_id" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_whatsapp_message_id" ON "public"."messages" USING "btree" ("whatsapp_message_id");



CREATE INDEX "idx_meta_limits_user_id" ON "public"."meta_limits" USING "btree" ("user_id");



CREATE INDEX "idx_meta_limits_waba_id" ON "public"."meta_limits" USING "btree" ("waba_id");



CREATE INDEX "idx_notes_lead_id" ON "public"."notes" USING "btree" ("lead_id");



CREATE INDEX "idx_notes_user_id" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "idx_pipeline_stages_pipeline_id" ON "public"."pipeline_stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_pipeline_stages_user_id" ON "public"."pipeline_stages" USING "btree" ("user_id");



CREATE INDEX "idx_pipelines_is_active" ON "public"."pipelines" USING "btree" ("is_active");



CREATE INDEX "idx_pipelines_user_id" ON "public"."pipelines" USING "btree" ("user_id");



CREATE INDEX "idx_stages_pipeline_id" ON "public"."stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_stages_position" ON "public"."stages" USING "btree" ("position");



CREATE INDEX "idx_tags_name" ON "public"."tags" USING "btree" ("name");



CREATE INDEX "idx_tags_user_id" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_lead_id" ON "public"."tasks" USING "btree" ("lead_id");



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_owner_id" ON "public"."team_members" USING "btree" ("owner_id");



CREATE INDEX "idx_team_members_owner_status" ON "public"."team_members" USING "btree" ("owner_id", "status");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_user_status" ON "public"."team_members" USING "btree" ("user_id", "status");



CREATE INDEX "idx_webhook_logs_webhook_id" ON "public"."webhook_logs" USING "btree" ("webhook_id");



CREATE INDEX "idx_whatsapp_config_user_id" ON "public"."whatsapp_config" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_flow_submissions_flow_id" ON "public"."whatsapp_flow_submissions" USING "btree" ("flow_id");



CREATE INDEX "idx_whatsapp_flow_submissions_user_id" ON "public"."whatsapp_flow_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_templates_name_lang" ON "public"."whatsapp_templates" USING "btree" ("name", "language");



CREATE INDEX "idx_whatsapp_templates_user_id" ON "public"."whatsapp_templates" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_templates_user_status" ON "public"."whatsapp_templates" USING "btree" ("user_id", "status");



CREATE OR REPLACE TRIGGER "check_limit_before_profile_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."check_tenant_limit"();



CREATE OR REPLACE TRIGGER "trg_update_flow_keywords" BEFORE INSERT OR UPDATE ON "public"."flows" FOR EACH ROW EXECUTE FUNCTION "public"."update_flow_keywords"();



CREATE OR REPLACE TRIGGER "update_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_forms_updated_at" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notes_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipelines_updated_at" BEFORE UPDATE ON "public"."pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stages_updated_at" BEFORE UPDATE ON "public"."stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."appointments"
    ADD CONSTRAINT "appointments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."branding_settings"
    ADD CONSTRAINT "branding_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."call_logs"
    ADD CONSTRAINT "call_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_queue"
    ADD CONSTRAINT "campaign_queue_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_queue"
    ADD CONSTRAINT "campaign_queue_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_groups"
    ADD CONSTRAINT "contact_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_fields"
    ADD CONSTRAINT "custom_fields_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flows"
    ADD CONSTRAINT "flows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_default_owner_id_fkey" FOREIGN KEY ("default_owner_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."forms"
    ADD CONSTRAINT "forms_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."integration_facebook_pages"
    ADD CONSTRAINT "integration_facebook_pages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."pipeline_stages"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."meta_limits"
    ADD CONSTRAINT "meta_limits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notes"
    ADD CONSTRAINT "notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline_stages"
    ADD CONSTRAINT "pipeline_stages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipelines"
    ADD CONSTRAINT "pipelines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sheet_automation_logs"
    ADD CONSTRAINT "sheet_automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."sheet_automations"("id");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipelines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tasks"
    ADD CONSTRAINT "tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_members"
    ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_integrations"
    ADD CONSTRAINT "user_integrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_security"
    ADD CONSTRAINT "user_security_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_subscriptions"
    ADD CONSTRAINT "user_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."webhook_logs"
    ADD CONSTRAINT "webhook_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_config"
    ADD CONSTRAINT "whatsapp_config_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."whatsapp_flow_submissions"
    ADD CONSTRAINT "whatsapp_flow_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."whatsapp_templates"
    ADD CONSTRAINT "whatsapp_templates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Agents can view own record" ON "public"."team_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Agents can view self" ON "public"."team_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow public read of limits" ON "public"."tenant_limits" FOR SELECT USING (true);



CREATE POLICY "Allow public read of plans" ON "public"."tenant_plans" FOR SELECT USING (true);



CREATE POLICY "Allow public read of settings" ON "public"."domain_settings" FOR SELECT USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."plans" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can submit forms" ON "public"."form_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Anyone can view forms by token" ON "public"."forms" FOR SELECT USING (true);



CREATE POLICY "Owners can delete team" ON "public"."team_members" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can insert team" ON "public"."team_members" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can manage team" ON "public"."team_members" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can update team" ON "public"."team_members" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can view team" ON "public"."team_members" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Public view active forms" ON "public"."forms" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Service role full access" ON "public"."domain_settings" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."profiles" USING (true) WITH CHECK (true);



CREATE POLICY "System can insert submissions" ON "public"."whatsapp_flow_submissions" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can delete campaigns" ON "public"."campaigns" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete contacts" ON "public"."contacts" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete conversations" ON "public"."conversations" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete fields" ON "public"."custom_fields" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete flows" ON "public"."flows" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete groups" ON "public"."contact_groups" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete own appointments" ON "public"."appointments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own call logs" ON "public"."call_logs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own call_logs" ON "public"."call_logs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own contacts" ON "public"."contacts" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete own fields" ON "public"."custom_fields" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete own flows" ON "public"."flows" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete own forms" ON "public"."forms" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own groups" ON "public"."contact_groups" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete own leads" ON "public"."leads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own notes" ON "public"."notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own pipelines" ON "public"."pipelines" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own tasks" ON "public"."tasks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own templates" ON "public"."whatsapp_templates" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete stages in own pipelines" ON "public"."stages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can delete templates" ON "public"."whatsapp_templates" FOR DELETE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can delete their own appointments" ON "public"."appointments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own call logs" ON "public"."call_logs" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own campaigns" ON "public"."campaigns" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own contacts" ON "public"."contacts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own conversations" ON "public"."conversations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own fields" ON "public"."custom_fields" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own flows" ON "public"."flows" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own forms" ON "public"."forms" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own groups" ON "public"."contact_groups" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own integrations" ON "public"."user_integrations" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own leads" ON "public"."leads" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own notes" ON "public"."notes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own onboarding settings" ON "public"."onboarding_settings" FOR DELETE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can delete their own pages" ON "public"."integration_facebook_pages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own pipelines" ON "public"."pipelines" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own stages" ON "public"."pipeline_stages" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own submissions" ON "public"."whatsapp_flow_submissions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tags" ON "public"."tags" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own tasks" ON "public"."tasks" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own templates" ON "public"."whatsapp_templates" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own whatsapp config" ON "public"."whatsapp_config" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert appointments for own leads" ON "public"."appointments" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "appointments"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert branding" ON "public"."branding_settings" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert call logs for own leads" ON "public"."call_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "call_logs"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert config" ON "public"."whatsapp_config" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert fields" ON "public"."custom_fields" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert flows" ON "public"."flows" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert groups" ON "public"."contact_groups" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert into campaign_queue for their campaigns" ON "public"."campaign_queue" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "campaign_queue"."campaign_id") AND ("campaigns"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert limits" ON "public"."meta_limits" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert messages" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "public"."get_active_owner_id"())))));



CREATE POLICY "Users can insert messages into their conversations" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert notes for own leads" ON "public"."notes" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "notes"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own appointments" ON "public"."appointments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own call_logs" ON "public"."call_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert own contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert own fields" ON "public"."custom_fields" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert own flows" ON "public"."flows" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert own forms" ON "public"."forms" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own groups" ON "public"."contact_groups" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert own leads" ON "public"."leads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own messages" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."user_id" = "public"."get_active_owner_id"())))));



CREATE POLICY "Users can insert own notes" ON "public"."notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own pipelines" ON "public"."pipelines" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own templates" ON "public"."whatsapp_templates" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert security" ON "public"."user_security" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert stages in own pipelines" ON "public"."stages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert tasks for own leads" ON "public"."tasks" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "tasks"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert templates" ON "public"."whatsapp_templates" FOR INSERT WITH CHECK (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can insert their own appointments" ON "public"."appointments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own branding" ON "public"."branding_settings" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own call logs" ON "public"."call_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own campaigns" ON "public"."campaigns" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own contacts" ON "public"."contacts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own conversations" ON "public"."conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own fields" ON "public"."custom_fields" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own flow sessions" ON "public"."flow_sessions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own flows" ON "public"."flows" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own forms" ON "public"."forms" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own groups" ON "public"."contact_groups" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own integrations" ON "public"."user_integrations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own leads" ON "public"."leads" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own limits" ON "public"."meta_limits" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own notes" ON "public"."notes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own onboarding settings" ON "public"."onboarding_settings" FOR INSERT WITH CHECK ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can insert their own pages" ON "public"."integration_facebook_pages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own pipelines" ON "public"."pipelines" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own security settings" ON "public"."user_security" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own stages" ON "public"."pipeline_stages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tags" ON "public"."tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own templates" ON "public"."whatsapp_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own whatsapp config" ON "public"."whatsapp_config" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own pipeline_stages" ON "public"."pipeline_stages" USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "pipeline_stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update branding" ON "public"."branding_settings" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update campaigns" ON "public"."campaigns" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update config" ON "public"."whatsapp_config" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update contacts" ON "public"."contacts" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update conversations" ON "public"."conversations" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update fields" ON "public"."custom_fields" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update flows" ON "public"."flows" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update groups" ON "public"."contact_groups" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update limits" ON "public"."meta_limits" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update own appointments" ON "public"."appointments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own call_logs" ON "public"."call_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own contacts" ON "public"."contacts" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update own conversations" ON "public"."conversations" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update own flows" ON "public"."flows" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update own forms" ON "public"."forms" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own groups" ON "public"."contact_groups" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update own leads" ON "public"."leads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own notes" ON "public"."notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own pipelines" ON "public"."pipelines" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own tasks" ON "public"."tasks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own templates" ON "public"."whatsapp_templates" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update security" ON "public"."user_security" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update stages in own pipelines" ON "public"."stages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update templates" ON "public"."whatsapp_templates" FOR UPDATE USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can update their own appointments" ON "public"."appointments" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own branding" ON "public"."branding_settings" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own call logs" ON "public"."call_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own campaign_queue items" ON "public"."campaign_queue" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "campaign_queue"."campaign_id") AND ("campaigns"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can update their own campaigns" ON "public"."campaigns" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own contacts" ON "public"."contacts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own conversations" ON "public"."conversations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own fields" ON "public"."custom_fields" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own flow sessions" ON "public"."flow_sessions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own flows" ON "public"."flows" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own forms" ON "public"."forms" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own groups" ON "public"."contact_groups" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own integrations" ON "public"."user_integrations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own leads" ON "public"."leads" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own limits" ON "public"."meta_limits" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own notes" ON "public"."notes" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own onboarding settings" ON "public"."onboarding_settings" FOR UPDATE USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can update their own pages" ON "public"."integration_facebook_pages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own pipelines" ON "public"."pipelines" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own security settings" ON "public"."user_security" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own stages" ON "public"."pipeline_stages" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own submissions" ON "public"."whatsapp_flow_submissions" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tags" ON "public"."tags" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own tasks" ON "public"."tasks" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own templates" ON "public"."whatsapp_templates" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own whatsapp config" ON "public"."whatsapp_config" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view appointments for own leads" ON "public"."appointments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "appointments"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view branding" ON "public"."branding_settings" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view call logs for own leads" ON "public"."call_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "call_logs"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view campaigns" ON "public"."campaigns" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view config" ON "public"."whatsapp_config" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view contacts" ON "public"."contacts" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view conversations" ON "public"."conversations" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view fields" ON "public"."custom_fields" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view flows" ON "public"."flows" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view groups" ON "public"."contact_groups" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view limits" ON "public"."meta_limits" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view messages" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND ("conversations"."user_id" = "public"."get_active_owner_id"())))));



CREATE POLICY "Users can view messages of their conversations" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view notes for own leads" ON "public"."notes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "notes"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own appointments" ON "public"."appointments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own call_logs" ON "public"."call_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own campaigns" ON "public"."campaigns" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own config" ON "public"."whatsapp_config" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own contacts" ON "public"."contacts" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own conversations" ON "public"."conversations" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own fields" ON "public"."custom_fields" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own flows" ON "public"."flows" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own forms" ON "public"."forms" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own groups" ON "public"."contact_groups" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view own leads" ON "public"."leads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own messages" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."conversations" "c"
  WHERE (("c"."id" = "messages"."conversation_id") AND ("c"."user_id" = "public"."get_active_owner_id"())))));



CREATE POLICY "Users can view own notes" ON "public"."notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own pipeline_stages" ON "public"."pipeline_stages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "pipeline_stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own pipelines" ON "public"."pipelines" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view own subscriptions" ON "public"."user_subscriptions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own tasks" ON "public"."tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own templates" ON "public"."whatsapp_templates" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view security" ON "public"."user_security" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view stages of own pipelines" ON "public"."stages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view tasks for own leads" ON "public"."tasks" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."leads"
  WHERE (("leads"."id" = "tasks"."lead_id") AND ("leads"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view templates" ON "public"."whatsapp_templates" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



CREATE POLICY "Users can view their form submissions" ON "public"."form_submissions" FOR SELECT USING (("form_id" IN ( SELECT "forms"."id"
   FROM "public"."forms"
  WHERE ("forms"."user_id" = "auth"."uid"()))));



CREATE POLICY "Users can view their own appointments" ON "public"."appointments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own branding" ON "public"."branding_settings" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own call logs" ON "public"."call_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own campaign queue" ON "public"."campaign_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "campaign_queue"."campaign_id") AND ("campaigns"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own campaign_queue items" ON "public"."campaign_queue" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns"
  WHERE (("campaigns"."id" = "campaign_queue"."campaign_id") AND ("campaigns"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own campaigns" ON "public"."campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own contacts" ON "public"."contacts" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own conversations" ON "public"."conversations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own fields" ON "public"."custom_fields" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own flow sessions" ON "public"."flow_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own flows" ON "public"."flows" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own forms" ON "public"."forms" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own groups" ON "public"."contact_groups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own integrations" ON "public"."user_integrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own leads" ON "public"."leads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own limits" ON "public"."meta_limits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own notes" ON "public"."notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own onboarding settings" ON "public"."onboarding_settings" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own pages" ON "public"."integration_facebook_pages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pipelines" ON "public"."pipelines" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own security settings" ON "public"."user_security" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own stages" ON "public"."pipeline_stages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own submissions" ON "public"."whatsapp_flow_submissions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tags" ON "public"."tags" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own tasks" ON "public"."tasks" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own templates" ON "public"."whatsapp_templates" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own webhook logs" ON "public"."webhook_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own whatsapp config" ON "public"."whatsapp_config" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view webhook_logs" ON "public"."webhook_logs" FOR SELECT USING (("user_id" = "public"."get_active_owner_id"()));



ALTER TABLE "public"."appointments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."branding_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."call_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_queue" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domain_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."form_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."forms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."integration_facebook_pages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."meta_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."onboarding_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipelines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_flow_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_templates" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_in"("cstring") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_out"("public"."gtrgm") TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_admin_status"("check_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_admin_status"("check_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_admin_status"("check_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_tenant"("target_domain" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_tenant"("target_domain" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_tenant"("target_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_org_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_tenant_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_tenant_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_tenant_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_schema_deep_info"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_schema_deep_info"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_schema_deep_info"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_query_trgm"("text", "internal", smallint, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_extract_value_trgm"("text", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_consistent"("internal", smallint, "text", integer, "internal", "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gin_trgm_triconsistent"("internal", smallint, "text", integer, "internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_compress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_consistent"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_decompress"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_distance"("internal", "text", smallint, "oid", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_options"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_penalty"("internal", "internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_picksplit"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_same"("public"."gtrgm", "public"."gtrgm", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "anon";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."gtrgm_union"("internal", "internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."increment_campaign_success"("row_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."increment_campaign_success"("row_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."increment_campaign_success"("row_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_lead_stage_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_lead_stage_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_lead_stage_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "postgres";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "anon";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_limit"(real) TO "service_role";



GRANT ALL ON FUNCTION "public"."show_limit"() TO "postgres";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_limit"() TO "service_role";



GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "postgres";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "anon";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."show_trgm"("text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_dist"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."strict_word_similarity_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_commutator_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_dist_op"("text", "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "postgres";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "anon";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."word_similarity_op"("text", "text") TO "service_role";


















GRANT ALL ON TABLE "public"."appointments" TO "anon";
GRANT ALL ON TABLE "public"."appointments" TO "authenticated";
GRANT ALL ON TABLE "public"."appointments" TO "service_role";



GRANT ALL ON TABLE "public"."branding_settings" TO "anon";
GRANT ALL ON TABLE "public"."branding_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."branding_settings" TO "service_role";



GRANT ALL ON TABLE "public"."call_logs" TO "anon";
GRANT ALL ON TABLE "public"."call_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."call_logs" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_queue" TO "anon";
GRANT ALL ON TABLE "public"."campaign_queue" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_queue" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."contact_groups" TO "anon";
GRANT ALL ON TABLE "public"."contact_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_groups" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."custom_fields" TO "anon";
GRANT ALL ON TABLE "public"."custom_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_fields" TO "service_role";



GRANT ALL ON TABLE "public"."domain_settings" TO "anon";
GRANT ALL ON TABLE "public"."domain_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."domain_settings" TO "service_role";



GRANT ALL ON TABLE "public"."flow_sessions" TO "anon";
GRANT ALL ON TABLE "public"."flow_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."flows" TO "anon";
GRANT ALL ON TABLE "public"."flows" TO "authenticated";
GRANT ALL ON TABLE "public"."flows" TO "service_role";



GRANT ALL ON TABLE "public"."form_submissions" TO "anon";
GRANT ALL ON TABLE "public"."form_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."form_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."forms" TO "anon";
GRANT ALL ON TABLE "public"."forms" TO "authenticated";
GRANT ALL ON TABLE "public"."forms" TO "service_role";



GRANT ALL ON TABLE "public"."integration_facebook_pages" TO "anon";
GRANT ALL ON TABLE "public"."integration_facebook_pages" TO "authenticated";
GRANT ALL ON TABLE "public"."integration_facebook_pages" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."meta_limits" TO "anon";
GRANT ALL ON TABLE "public"."meta_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."meta_limits" TO "service_role";



GRANT ALL ON SEQUENCE "public"."meta_limits_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."meta_limits_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."meta_limits_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."notes" TO "anon";
GRANT ALL ON TABLE "public"."notes" TO "authenticated";
GRANT ALL ON TABLE "public"."notes" TO "service_role";



GRANT ALL ON TABLE "public"."onboarding_settings" TO "anon";
GRANT ALL ON TABLE "public"."onboarding_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."onboarding_settings" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline_stages" TO "anon";
GRANT ALL ON TABLE "public"."pipeline_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline_stages" TO "service_role";



GRANT ALL ON TABLE "public"."pipelines" TO "anon";
GRANT ALL ON TABLE "public"."pipelines" TO "authenticated";
GRANT ALL ON TABLE "public"."pipelines" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."sheet_automation_logs" TO "anon";
GRANT ALL ON TABLE "public"."sheet_automation_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."sheet_automation_logs" TO "service_role";



GRANT ALL ON TABLE "public"."sheet_automations" TO "anon";
GRANT ALL ON TABLE "public"."sheet_automations" TO "authenticated";
GRANT ALL ON TABLE "public"."sheet_automations" TO "service_role";



GRANT ALL ON TABLE "public"."stages" TO "anon";
GRANT ALL ON TABLE "public"."stages" TO "authenticated";
GRANT ALL ON TABLE "public"."stages" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."tasks" TO "anon";
GRANT ALL ON TABLE "public"."tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."tasks" TO "service_role";



GRANT ALL ON TABLE "public"."team_members" TO "anon";
GRANT ALL ON TABLE "public"."team_members" TO "authenticated";
GRANT ALL ON TABLE "public"."team_members" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_limits" TO "anon";
GRANT ALL ON TABLE "public"."tenant_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_limits" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_plans" TO "anon";
GRANT ALL ON TABLE "public"."tenant_plans" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_plans" TO "service_role";



GRANT ALL ON TABLE "public"."user_integrations" TO "anon";
GRANT ALL ON TABLE "public"."user_integrations" TO "authenticated";
GRANT ALL ON TABLE "public"."user_integrations" TO "service_role";



GRANT ALL ON TABLE "public"."user_security" TO "anon";
GRANT ALL ON TABLE "public"."user_security" TO "authenticated";
GRANT ALL ON TABLE "public"."user_security" TO "service_role";



GRANT ALL ON TABLE "public"."user_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."user_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."webhook_logs" TO "anon";
GRANT ALL ON TABLE "public"."webhook_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."webhook_logs" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_config" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_config" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_config" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_flow_submissions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_flow_submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_flow_submissions" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_templates" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_templates" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































