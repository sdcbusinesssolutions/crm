


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


CREATE SCHEMA IF NOT EXISTS "auth";


ALTER SCHEMA "auth" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE SCHEMA IF NOT EXISTS "realtime";


ALTER SCHEMA "realtime" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "storage";


ALTER SCHEMA "storage" OWNER TO "supabase_admin";


CREATE SCHEMA IF NOT EXISTS "supabase_functions";


ALTER SCHEMA "supabase_functions" OWNER TO "supabase_admin";


CREATE TYPE "auth"."aal_level" AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


ALTER TYPE "auth"."aal_level" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."code_challenge_method" AS ENUM (
    's256',
    'plain'
);


ALTER TYPE "auth"."code_challenge_method" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_status" AS ENUM (
    'unverified',
    'verified'
);


ALTER TYPE "auth"."factor_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."factor_type" AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


ALTER TYPE "auth"."factor_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_authorization_status" AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


ALTER TYPE "auth"."oauth_authorization_status" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_client_type" AS ENUM (
    'public',
    'confidential'
);


ALTER TYPE "auth"."oauth_client_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_registration_type" AS ENUM (
    'dynamic',
    'manual'
);


ALTER TYPE "auth"."oauth_registration_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."oauth_response_type" AS ENUM (
    'code'
);


ALTER TYPE "auth"."oauth_response_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "auth"."one_time_token_type" AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


ALTER TYPE "auth"."one_time_token_type" OWNER TO "supabase_auth_admin";


CREATE TYPE "realtime"."action" AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


ALTER TYPE "realtime"."action" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."equality_op" AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


ALTER TYPE "realtime"."equality_op" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."user_defined_filter" AS (
	"column_name" "text",
	"op" "realtime"."equality_op",
	"value" "text"
);


ALTER TYPE "realtime"."user_defined_filter" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."wal_column" AS (
	"name" "text",
	"type_name" "text",
	"type_oid" "oid",
	"value" "jsonb",
	"is_pkey" boolean,
	"is_selectable" boolean
);


ALTER TYPE "realtime"."wal_column" OWNER TO "supabase_admin";


CREATE TYPE "realtime"."wal_rls" AS (
	"wal" "jsonb",
	"is_rls_enabled" boolean,
	"subscription_ids" "uuid"[],
	"errors" "text"[]
);


ALTER TYPE "realtime"."wal_rls" OWNER TO "supabase_admin";


CREATE TYPE "storage"."buckettype" AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


ALTER TYPE "storage"."buckettype" OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "auth"."email"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


ALTER FUNCTION "auth"."email"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."email"() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';



CREATE OR REPLACE FUNCTION "auth"."jwt"() RETURNS "jsonb"
    LANGUAGE "sql" STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


ALTER FUNCTION "auth"."jwt"() OWNER TO "supabase_auth_admin";


CREATE OR REPLACE FUNCTION "auth"."role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


ALTER FUNCTION "auth"."role"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."role"() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';



CREATE OR REPLACE FUNCTION "auth"."uid"() RETURNS "uuid"
    LANGUAGE "sql" STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


ALTER FUNCTION "auth"."uid"() OWNER TO "supabase_auth_admin";


COMMENT ON FUNCTION "auth"."uid"() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';



CREATE OR REPLACE FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer DEFAULT 10, "plan_name" "text" DEFAULT 'Free'::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    LANGUAGE "sql"
    SET "search_path" TO 'public'
    AS $$
    UPDATE flow_sessions
    SET status = 'cancelled'
    WHERE contact_phone = p_contact_phone
    AND status IN ('active', 'waiting_input', 'processing', 'delayed');
$$;


ALTER FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_admin_status"("check_domain" "text") RETURNS TABLE("is_banned" boolean, "fail_reason" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."drip_enrollments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "drip_campaign_id" "uuid",
    "contact_id" "uuid",
    "current_step_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "next_run_at" timestamp with time zone,
    "last_run_at" timestamp with time zone,
    "started_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "stop_at" timestamp with time zone,
    "notifications_sent" "jsonb" DEFAULT '[]'::"jsonb",
    "notification_rules" "jsonb" DEFAULT '[]'::"jsonb",
    "is_looping" boolean DEFAULT false
);


ALTER TABLE "public"."drip_enrollments" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fetch_and_lock_drip_jobs"("batch_size" integer) RETURNS SETOF "public"."drip_enrollments"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    WITH locked_rows AS (
        SELECT id
        FROM drip_enrollments
        WHERE status = 'ACTIVE'
          AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
        LIMIT batch_size
        FOR UPDATE SKIP LOCKED -- CRITICAL: Skips rows locked by other workers
    )
    UPDATE drip_enrollments
    SET next_run_at = NOW() + INTERVAL '5 minutes' -- Reserve for 5 mins
    WHERE id IN (SELECT id FROM locked_rows)
    RETURNING *;
END;
$$;


ALTER FUNCTION "public"."fetch_and_lock_drip_jobs"("batch_size" integer) OWNER TO "postgres";


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
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    LANGUAGE "plpgsql" STABLE
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."get_active_session"("p_contact_phone" "text") RETURNS SETOF "public"."flow_sessions"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT * 
    FROM flow_sessions
    WHERE contact_phone = p_contact_phone
    AND status IN ('active', 'waiting_input', 'processing', 'delayed')
    LIMIT 1; -- Should always be 1 max due to Unique Index
$$;


ALTER FUNCTION "public"."get_active_session"("p_contact_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_all_tenants_summary"() RETURNS TABLE("domain" "text", "brand_name" "text", "user_count" bigint, "user_limit" integer, "plan_name" "text", "plan_status" "text", "plan_expires_at" timestamp with time zone, "admin_email" "text")
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    stats JSON;
    recent_leads JSON;
    pipeline_stats JSON;
BEGIN
    -- 1. Get Basic Aggregations
    SELECT json_build_object(
        'totalPipelineValue', COALESCE(SUM(estimated_value), 0),
        'wonValue', COALESCE(SUM(estimated_value) FILTER (WHERE status = 'won' OR stage_id ILIKE '%won%'), 0),
        'wonCount', COUNT(*) FILTER (WHERE status = 'won' OR stage_id ILIKE '%won%'),
        'activeLeads', COUNT(*) FILTER (WHERE status = 'active'),
        'newLeadsToday', COUNT(*) FILTER (WHERE created_at >= current_date),
        'totalLeads', COUNT(*)
    ) INTO stats
    FROM leads
    WHERE user_id = p_user_id;

    -- 2. Get Recent 5 Leads
    SELECT COALESCE(json_agg(row_to_json(rl)), '[]'::json) INTO recent_leads
    FROM (
        SELECT id, name, created_at, status, pipeline_id, stage_id
        FROM leads
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 5
    ) rl;

    -- 3. Get Pipeline Stage Counts
    SELECT COALESCE(json_agg(row_to_json(ps)), '[]'::json) INTO pipeline_stats
    FROM (
        SELECT 
            p.id as pipeline_id, 
            p.name as pipeline_name,
            COUNT(l.id) as total_leads,
            COALESCE(
                json_agg(
                    json_build_object('stage_id', s.id, 'name', s.name, 'count', (
                        SELECT COUNT(*) FROM leads sl WHERE sl.stage_id = s.id AND sl.user_id = p_user_id
                    ))
                ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
            ) as stages
        FROM pipelines p
        LEFT JOIN pipeline_stages s ON s.pipeline_id = p.id
        LEFT JOIN leads l ON l.pipeline_id = p.id AND l.user_id = p_user_id
        WHERE p.user_id = p_user_id
        GROUP BY p.id, p.name
    ) ps;

    RETURN json_build_object(
        'summary', stats,
        'recentLeads', recent_leads,
        'pipelineStats', pipeline_stats
    );
END;
$$;


ALTER FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") RETURNS SETOF "public"."flows"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM flows
    WHERE user_id = p_user_id
    AND LOWER(status) = 'published'  -- Case-insensitive status comparison
    AND (
        -- Search in trigger_keywords TEXT ARRAY (case-insensitive)
        EXISTS (
            SELECT 1 
            FROM unnest(trigger_keywords) AS keyword
            WHERE LOWER(keyword) = LOWER(p_keyword)
        )
    )
    LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") RETURNS TABLE("raw_payload" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "public"."get_lead_dashboard_stats_v2"("p_user_id" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    result JSONB;
    v_pipeline_count INTEGER;
    v_contact_count INTEGER;
    v_form_count INTEGER;
    v_task_count INTEGER;
    v_group_count INTEGER;
    v_pipelines_json JSONB;
    v_stats_map JSONB;
    v_recent_leads JSONB;
    v_leads_by_source JSONB;
    v_leads_by_tag JSONB;
    v_groups_json JSONB;
    v_leads_over_time JSONB;
    v_forms_over_time JSONB;
    v_tasks_over_time JSONB;
BEGIN
    -- 1. Summary Counts (Parallelized execution in Postgres)
    SELECT COUNT(*) INTO v_pipeline_count FROM pipelines WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_contact_count FROM contacts WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_form_count FROM forms WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_task_count FROM tasks WHERE user_id = p_user_id;
    SELECT COUNT(*) INTO v_group_count FROM contact_groups WHERE user_id = p_user_id;

    -- 2. Pipeline List
    SELECT jsonb_agg(p.*) INTO v_pipelines_json 
    FROM (SELECT id, name, is_default, color FROM pipelines WHERE user_id = p_user_id ORDER BY created_at DESC) p;

    -- 3. Pipeline Stats Map (Optimized Join)
    SELECT jsonb_object_agg(p_id, stats) INTO v_stats_map
    FROM (
        SELECT 
            p.id as p_id,
            jsonb_build_object(
                'name', p.name,
                'totalLeads', COUNT(l.id),
                'totalValue', COALESCE(SUM(l.estimated_value), 0),
                'stages', (
                    SELECT jsonb_agg(s_data)
                    FROM (
                        SELECT 
                            ps.id, 
                            ps.name, 
                            ps.color,
                            COUNT(l2.id) as count,
                            COALESCE(SUM(l2.estimated_value), 0) as value
                        FROM pipeline_stages ps
                        LEFT JOIN leads l2 ON l2.stage_id = ps.id AND l2.user_id = p_user_id
                        WHERE ps.pipeline_id = p.id
                        GROUP BY ps.id, ps.name, ps.color, ps.display_order
                        ORDER BY ps.display_order ASC
                    ) s_data
                )
            ) as stats
        FROM pipelines p
        LEFT JOIN leads l ON l.pipeline_id = p.id AND l.user_id = p_user_id
        WHERE p.user_id = p_user_id
        GROUP BY p.id, p.name
    ) pipe_totals;

    -- 4. Recent Leads
    SELECT jsonb_agg(rl) INTO v_recent_leads
    FROM (
        SELECT id, name, source, estimated_value, created_at, status
        FROM leads
        WHERE user_id = p_user_id
        ORDER BY created_at DESC
        LIMIT 5
    ) rl;

    -- 5. Leads By Source
    SELECT jsonb_agg(src) INTO v_leads_by_source
    FROM (
        SELECT 
            COALESCE(source, 'Unknown') as name, 
            COUNT(*) as count,
            COALESCE(SUM(estimated_value), 0) as value
        FROM leads
        WHERE user_id = p_user_id
        GROUP BY source
        ORDER BY count DESC
    ) src;

    -- 6. Top Tags (Optimized Aggregation)
    SELECT jsonb_agg(tg) INTO v_leads_by_tag
    FROM (
        SELECT 
            tag_name as name, 
            COUNT(*) as count,
            '#6366f1' as color
        FROM contacts, 
        LATERAL unnest(COALESCE(tags, ARRAY[]::text[])) as tag_name
        WHERE user_id = p_user_id
        GROUP BY tag_name
        ORDER BY count DESC
        LIMIT 10
    ) tg;

    -- 7. Top Groups (REPLACED Subquery with Optimized Join)
    SELECT jsonb_agg(grp) INTO v_groups_json
    FROM (
        SELECT 
            cg.name, 
            COUNT(c.id) as count
        FROM contact_groups cg
        LEFT JOIN contacts c ON cg.id::text = ANY(COALESCE(c.group_ids, ARRAY[]::text[])) AND c.user_id = p_user_id
        WHERE cg.user_id = p_user_id
        GROUP BY cg.id, cg.name
        ORDER BY count DESC
        LIMIT 5
    ) grp;

    -- 8. Activity Over Time (Aligned Sun-Sat Week)
    WITH days AS (
        SELECT (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day' + generate_series(0, 6) * INTERVAL '1 day')::date as d
    )
    SELECT jsonb_agg(lot) INTO v_leads_over_time
    FROM (
        SELECT TO_CHAR(d, 'YYYY-MM-DD') as date, TO_CHAR(d, 'Dy') as "dayName", COUNT(c.id) as count
        FROM days d
        LEFT JOIN contacts c ON c.created_at::date = d AND c.user_id = p_user_id
        GROUP BY d
        ORDER BY d ASC
    ) lot;

    WITH days AS (
        SELECT (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day' + generate_series(0, 6) * INTERVAL '1 day')::date as d
    )
    SELECT jsonb_agg(fot) INTO v_forms_over_time
    FROM (
        SELECT TO_CHAR(d, 'YYYY-MM-DD') as date, TO_CHAR(d, 'Dy') as "dayName", COUNT(f.id) as count
        FROM days d
        LEFT JOIN forms f ON f.created_at::date = d AND f.user_id = p_user_id
        GROUP BY d
        ORDER BY d ASC
    ) fot;

    WITH days AS (
        SELECT (date_trunc('week', CURRENT_DATE) - INTERVAL '1 day' + generate_series(0, 6) * INTERVAL '1 day')::date as d
    )
    SELECT jsonb_agg(tot) INTO v_tasks_over_time
    FROM (
        SELECT TO_CHAR(d, 'YYYY-MM-DD') as date, TO_CHAR(d, 'Dy') as "dayName", COUNT(t.id) as count
        FROM days d
        LEFT JOIN tasks t ON t.created_at::date = d AND t.user_id = p_user_id
        GROUP BY d
        ORDER BY d ASC
    ) tot;

    -- Final Assembly
    result := jsonb_build_object(
        'pipelineCount', COALESCE(v_pipeline_count, 0),
        'contactCount', COALESCE(v_contact_count, 0),
        'formCount', COALESCE(v_form_count, 0),
        'taskCount', COALESCE(v_task_count, 0),
        'groupCount', COALESCE(v_group_count, 0),
        'pipelines', COALESCE(v_pipelines_json, '[]'::jsonb),
        'pipelineStatsMap', COALESCE(v_stats_map, '{}'::jsonb),
        'recentLeads', COALESCE(v_recent_leads, '[]'::jsonb),
        'leadsBySource', COALESCE(v_leads_by_source, '[]'::jsonb),
        'leadsByTag', COALESCE(v_leads_by_tag, '[]'::jsonb),
        'groups', COALESCE(v_groups_json, '[]'::jsonb),
        'leadsOverTime', COALESCE(v_leads_over_time, '[]'::jsonb),
        'formsOverTime', COALESCE(v_forms_over_time, '[]'::jsonb),
        'tasksOverTime', COALESCE(v_tasks_over_time, '[]'::jsonb),
        'timestamp', NOW()
    );

    RETURN result;
END;
$$;


ALTER FUNCTION "public"."get_lead_dashboard_stats_v2"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_org_ids"() RETURNS "uuid"[]
    LANGUAGE "plpgsql" STABLE
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
    SET "search_path" TO 'public'
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
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
    AS $$
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
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."increment_campaign_failed"("row_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE campaigns
  SET success_count = success_count + 1
  WHERE id = row_id;
END;
$$;


ALTER FUNCTION "public"."increment_campaign_success"("row_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lock_session_for_processing"("p_session_id" "uuid") RETURNS SETOF "public"."flow_sessions"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    UPDATE flow_sessions
    SET status = 'processing',
        last_interaction_at = NOW()
    WHERE id = p_session_id
    AND status = 'waiting_input' -- CRITICAL: Only lock if it was explicitly waiting
    RETURNING *;
END;
$$;


ALTER FUNCTION "public"."lock_session_for_processing"("p_session_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_lead_stage_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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
    SET "search_path" TO 'public'
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


CREATE OR REPLACE FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer DEFAULT (1024 * 1024)) RETURNS SETOF "realtime"."wal_rls"
    LANGUAGE "plpgsql"
    AS $$
declare
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

columns realtime.wal_column[];
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


ALTER FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text" DEFAULT 'ROW'::"text") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


ALTER FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) RETURNS "text"
    LANGUAGE "sql"
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


ALTER FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") RETURNS "jsonb"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
declare
  res jsonb;
begin
  if type_::text = 'bytea' then
    return to_jsonb(val);
  end if;
  execute format('select to_jsonb(%L::'|| type_::text || ')', val) into res;
  return res;
end
$$;


ALTER FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") RETURNS boolean
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


ALTER FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) RETURNS boolean
    LANGUAGE "sql" IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


ALTER FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) RETURNS TABLE("wal" "jsonb", "is_rls_enabled" boolean, "subscription_ids" "uuid"[], "errors" "text"[], "slot_changes_count" bigint)
    LANGUAGE "sql"
    SET "log_min_messages" TO 'fatal'
    AS $$
  WITH pub AS (
    SELECT
      concat_ws(
        ',',
        CASE WHEN bool_or(pubinsert) THEN 'insert' ELSE NULL END,
        CASE WHEN bool_or(pubupdate) THEN 'update' ELSE NULL END,
        CASE WHEN bool_or(pubdelete) THEN 'delete' ELSE NULL END
      ) AS w2j_actions,
      coalesce(
        string_agg(
          realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
          ','
        ) filter (WHERE ppt.tablename IS NOT NULL AND ppt.tablename NOT LIKE '% %'),
        ''
      ) AS w2j_add_tables
    FROM pg_publication pp
    LEFT JOIN pg_publication_tables ppt ON pp.pubname = ppt.pubname
    WHERE pp.pubname = publication
    GROUP BY pp.pubname
    LIMIT 1
  ),
  -- MATERIALIZED ensures pg_logical_slot_get_changes is called exactly once
  w2j AS MATERIALIZED (
    SELECT x.*, pub.w2j_add_tables
    FROM pub,
         pg_logical_slot_get_changes(
           slot_name, null, max_changes,
           'include-pk', 'true',
           'include-transaction', 'false',
           'include-timestamp', 'true',
           'include-type-oids', 'true',
           'format-version', '2',
           'actions', pub.w2j_actions,
           'add-tables', pub.w2j_add_tables
         ) x
  ),
  -- Count raw slot entries before apply_rls/subscription filter
  slot_count AS (
    SELECT count(*)::bigint AS cnt
    FROM w2j
    WHERE w2j.w2j_add_tables <> ''
  ),
  -- Apply RLS and filter as before
  rls_filtered AS (
    SELECT xyz.wal, xyz.is_rls_enabled, xyz.subscription_ids, xyz.errors
    FROM w2j,
         realtime.apply_rls(
           wal := w2j.data::jsonb,
           max_record_bytes := max_record_bytes
         ) xyz(wal, is_rls_enabled, subscription_ids, errors)
    WHERE w2j.w2j_add_tables <> ''
      AND xyz.subscription_ids[1] IS NOT NULL
  )
  -- Real rows with slot count attached
  SELECT rf.wal, rf.is_rls_enabled, rf.subscription_ids, rf.errors, sc.cnt
  FROM rls_filtered rf, slot_count sc

  UNION ALL

  -- Sentinel row: always returned when no real rows exist so Elixir can
  -- always read slot_changes_count. Identified by wal IS NULL.
  SELECT null, null, null, null, sc.cnt
  FROM slot_count sc
  WHERE NOT EXISTS (SELECT 1 FROM rls_filtered)
$$;


ALTER FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."quote_wal2json"("entity" "regclass") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


ALTER FUNCTION "realtime"."quote_wal2json"("entity" "regclass") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean DEFAULT true) RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


ALTER FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."subscription_check_filters"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


ALTER FUNCTION "realtime"."subscription_check_filters"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."to_regrole"("role_name" "text") RETURNS "regrole"
    LANGUAGE "sql" IMMUTABLE
    AS $$ select role_name::regrole $$;


ALTER FUNCTION "realtime"."to_regrole"("role_name" "text") OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "realtime"."topic"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


ALTER FUNCTION "realtime"."topic"() OWNER TO "supabase_realtime_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT CASE
      WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
      ELSE raw_operation
    END AS current_operation
    FROM current_operation
  )
  SELECT EXISTS (
    SELECT 1
    FROM normalized n
    CROSS JOIN LATERAL unnest(expected_operations) AS expected_operation
    WHERE expected_operation IS NOT NULL
      AND expected_operation <> ''
      AND n.current_operation = CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END
  );
$$;


ALTER FUNCTION "storage"."allow_any_operation"("expected_operations" "text"[]) OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."allow_only_operation"("expected_operation" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  WITH current_operation AS (
    SELECT storage.operation() AS raw_operation
  ),
  normalized AS (
    SELECT
      CASE
        WHEN raw_operation LIKE 'storage.%' THEN substr(raw_operation, 9)
        ELSE raw_operation
      END AS current_operation,
      CASE
        WHEN expected_operation LIKE 'storage.%' THEN substr(expected_operation, 9)
        ELSE expected_operation
      END AS requested_operation
    FROM current_operation
  )
  SELECT CASE
    WHEN requested_operation IS NULL OR requested_operation = '' THEN FALSE
    ELSE COALESCE(current_operation = requested_operation, FALSE)
  END
  FROM normalized;
$$;


ALTER FUNCTION "storage"."allow_only_operation"("expected_operation" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


ALTER FUNCTION "storage"."can_insert_object"("bucketid" "text", "name" "text", "owner" "uuid", "metadata" "jsonb") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."enforce_bucket_name_length"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


ALTER FUNCTION "storage"."enforce_bucket_name_length"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."extension"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Get the last path segment (the actual filename)
    SELECT _parts[array_length(_parts, 1)] INTO _filename;
    -- Extract extension: reverse, split on '.', then reverse again
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


ALTER FUNCTION "storage"."extension"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."filename"("name" "text") RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


ALTER FUNCTION "storage"."filename"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."foldername"("name" "text") RETURNS "text"[]
    LANGUAGE "plpgsql" IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


ALTER FUNCTION "storage"."foldername"("name" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


ALTER FUNCTION "storage"."get_common_prefix"("p_key" "text", "p_prefix" "text", "p_delimiter" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."get_size_by_bucket"() RETURNS TABLE("size" bigint, "bucket_id" "text")
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint)::bigint as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


ALTER FUNCTION "storage"."get_size_by_bucket"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "next_key_token" "text" DEFAULT ''::"text", "next_upload_token" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "id" "text", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql"
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


ALTER FUNCTION "storage"."list_multipart_uploads_with_delimiter"("bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "next_key_token" "text", "next_upload_token" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer DEFAULT 100, "start_after" "text" DEFAULT ''::"text", "next_token" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "metadata" "jsonb", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone)
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."list_objects_with_delimiter"("_bucket_id" "text", "prefix_param" "text", "delimiter_param" "text", "max_keys" integer, "start_after" "text", "next_token" "text", "sort_order" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."operation"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


ALTER FUNCTION "storage"."operation"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."protect_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "storage"."protect_delete"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "offsets" integer DEFAULT 0, "search" "text" DEFAULT ''::"text", "sortcolumn" "text" DEFAULT 'name'::"text", "sortorder" "text" DEFAULT 'asc'::"text") RETURNS TABLE("name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


ALTER FUNCTION "storage"."search"("prefix" "text", "bucketname" "text", "limits" integer, "levels" integer, "offsets" integer, "search" "text", "sortcolumn" "text", "sortorder" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


ALTER FUNCTION "storage"."search_by_timestamp"("p_prefix" "text", "p_bucket_id" "text", "p_limit" integer, "p_level" integer, "p_start_after" "text", "p_sort_order" "text", "p_sort_column" "text", "p_sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer DEFAULT 100, "levels" integer DEFAULT 1, "start_after" "text" DEFAULT ''::"text", "sort_order" "text" DEFAULT 'asc'::"text", "sort_column" "text" DEFAULT 'name'::"text", "sort_column_after" "text" DEFAULT ''::"text") RETURNS TABLE("key" "text", "name" "text", "id" "uuid", "updated_at" timestamp with time zone, "created_at" timestamp with time zone, "last_accessed_at" timestamp with time zone, "metadata" "jsonb")
    LANGUAGE "plpgsql" STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


ALTER FUNCTION "storage"."search_v2"("prefix" "text", "bucket_name" "text", "limits" integer, "levels" integer, "start_after" "text", "sort_order" "text", "sort_column" "text", "sort_column_after" "text") OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "storage"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


ALTER FUNCTION "storage"."update_updated_at_column"() OWNER TO "supabase_storage_admin";


CREATE OR REPLACE FUNCTION "supabase_functions"."http_request"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'supabase_functions'
    AS $$
    DECLARE
      request_id bigint;
      payload jsonb;
      url text := TG_ARGV[0]::text;
      method text := TG_ARGV[1]::text;
      headers jsonb DEFAULT '{}'::jsonb;
      params jsonb DEFAULT '{}'::jsonb;
      timeout_ms integer DEFAULT 1000;
    BEGIN
      IF url IS NULL OR url = 'null' THEN
        RAISE EXCEPTION 'url argument is missing';
      END IF;

      IF method IS NULL OR method = 'null' THEN
        RAISE EXCEPTION 'method argument is missing';
      END IF;

      IF TG_ARGV[2] IS NULL OR TG_ARGV[2] = 'null' THEN
        headers = '{"Content-Type": "application/json"}'::jsonb;
      ELSE
        headers = TG_ARGV[2]::jsonb;
      END IF;

      IF TG_ARGV[3] IS NULL OR TG_ARGV[3] = 'null' THEN
        params = '{}'::jsonb;
      ELSE
        params = TG_ARGV[3]::jsonb;
      END IF;

      IF TG_ARGV[4] IS NULL OR TG_ARGV[4] = 'null' THEN
        timeout_ms = 1000;
      ELSE
        timeout_ms = TG_ARGV[4]::integer;
      END IF;

      CASE
        WHEN method = 'GET' THEN
          SELECT http_get INTO request_id FROM net.http_get(
            url,
            params,
            headers,
            timeout_ms
          );
        WHEN method = 'POST' THEN
          payload = jsonb_build_object(
            'old_record', OLD,
            'record', NEW,
            'type', TG_OP,
            'table', TG_TABLE_NAME,
            'schema', TG_TABLE_SCHEMA
          );

          SELECT http_post INTO request_id FROM net.http_post(
            url,
            payload,
            params,
            headers,
            timeout_ms
          );
        ELSE
          RAISE EXCEPTION 'method argument % is invalid', method;
      END CASE;

      INSERT INTO supabase_functions.hooks
        (hook_table_id, hook_name, request_id)
      VALUES
        (TG_RELID, TG_NAME, request_id);

      RETURN NEW;
    END
  $$;


ALTER FUNCTION "supabase_functions"."http_request"() OWNER TO "supabase_functions_admin";


CREATE TABLE IF NOT EXISTS "auth"."audit_log_entries" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "payload" json,
    "created_at" timestamp with time zone,
    "ip_address" character varying(64) DEFAULT ''::character varying NOT NULL
);


ALTER TABLE "auth"."audit_log_entries" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."audit_log_entries" IS 'Auth: Audit trail for user actions.';



CREATE TABLE IF NOT EXISTS "auth"."custom_oauth_providers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider_type" "text" NOT NULL,
    "identifier" "text" NOT NULL,
    "name" "text" NOT NULL,
    "client_id" "text" NOT NULL,
    "client_secret" "text" NOT NULL,
    "acceptable_client_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "scopes" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "pkce_enabled" boolean DEFAULT true NOT NULL,
    "attribute_mapping" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "authorization_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "email_optional" boolean DEFAULT false NOT NULL,
    "issuer" "text",
    "discovery_url" "text",
    "skip_nonce_check" boolean DEFAULT false NOT NULL,
    "cached_discovery" "jsonb",
    "discovery_cached_at" timestamp with time zone,
    "authorization_url" "text",
    "token_url" "text",
    "userinfo_url" "text",
    "jwks_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "custom_oauth_providers_authorization_url_https" CHECK ((("authorization_url" IS NULL) OR ("authorization_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_authorization_url_length" CHECK ((("authorization_url" IS NULL) OR ("char_length"("authorization_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_client_id_length" CHECK ((("char_length"("client_id") >= 1) AND ("char_length"("client_id") <= 512))),
    CONSTRAINT "custom_oauth_providers_discovery_url_length" CHECK ((("discovery_url" IS NULL) OR ("char_length"("discovery_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_identifier_format" CHECK (("identifier" ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::"text")),
    CONSTRAINT "custom_oauth_providers_issuer_length" CHECK ((("issuer" IS NULL) OR (("char_length"("issuer") >= 1) AND ("char_length"("issuer") <= 2048)))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_https" CHECK ((("jwks_uri" IS NULL) OR ("jwks_uri" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_jwks_uri_length" CHECK ((("jwks_uri" IS NULL) OR ("char_length"("jwks_uri") <= 2048))),
    CONSTRAINT "custom_oauth_providers_name_length" CHECK ((("char_length"("name") >= 1) AND ("char_length"("name") <= 100))),
    CONSTRAINT "custom_oauth_providers_oauth2_requires_endpoints" CHECK ((("provider_type" <> 'oauth2'::"text") OR (("authorization_url" IS NOT NULL) AND ("token_url" IS NOT NULL) AND ("userinfo_url" IS NOT NULL)))),
    CONSTRAINT "custom_oauth_providers_oidc_discovery_url_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("discovery_url" IS NULL) OR ("discovery_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_issuer_https" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NULL) OR ("issuer" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_oidc_requires_issuer" CHECK ((("provider_type" <> 'oidc'::"text") OR ("issuer" IS NOT NULL))),
    CONSTRAINT "custom_oauth_providers_provider_type_check" CHECK (("provider_type" = ANY (ARRAY['oauth2'::"text", 'oidc'::"text"]))),
    CONSTRAINT "custom_oauth_providers_token_url_https" CHECK ((("token_url" IS NULL) OR ("token_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_token_url_length" CHECK ((("token_url" IS NULL) OR ("char_length"("token_url") <= 2048))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_https" CHECK ((("userinfo_url" IS NULL) OR ("userinfo_url" ~~ 'https://%'::"text"))),
    CONSTRAINT "custom_oauth_providers_userinfo_url_length" CHECK ((("userinfo_url" IS NULL) OR ("char_length"("userinfo_url") <= 2048)))
);


ALTER TABLE "auth"."custom_oauth_providers" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."flow_state" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid",
    "auth_code" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "code_challenge" "text",
    "provider_type" "text" NOT NULL,
    "provider_access_token" "text",
    "provider_refresh_token" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "authentication_method" "text" NOT NULL,
    "auth_code_issued_at" timestamp with time zone,
    "invite_token" "text",
    "referrer" "text",
    "oauth_client_state_id" "uuid",
    "linking_target_id" "uuid",
    "email_optional" boolean DEFAULT false NOT NULL
);


ALTER TABLE "auth"."flow_state" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."flow_state" IS 'Stores metadata for all OAuth/SSO login flows';



CREATE TABLE IF NOT EXISTS "auth"."identities" (
    "provider_id" "text" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "identity_data" "jsonb" NOT NULL,
    "provider" "text" NOT NULL,
    "last_sign_in_at" timestamp with time zone,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "email" "text" GENERATED ALWAYS AS ("lower"(("identity_data" ->> 'email'::"text"))) STORED,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "auth"."identities" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."identities" IS 'Auth: Stores identities associated to a user.';



COMMENT ON COLUMN "auth"."identities"."email" IS 'Auth: Email is a generated column that references the optional email property in the identity_data';



CREATE TABLE IF NOT EXISTS "auth"."instances" (
    "id" "uuid" NOT NULL,
    "uuid" "uuid",
    "raw_base_config" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "auth"."instances" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."instances" IS 'Auth: Manages users across multiple sites.';



CREATE TABLE IF NOT EXISTS "auth"."mfa_amr_claims" (
    "session_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "authentication_method" "text" NOT NULL,
    "id" "uuid" NOT NULL
);


ALTER TABLE "auth"."mfa_amr_claims" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_amr_claims" IS 'auth: stores authenticator method reference claims for multi factor authentication';



CREATE TABLE IF NOT EXISTS "auth"."mfa_challenges" (
    "id" "uuid" NOT NULL,
    "factor_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "verified_at" timestamp with time zone,
    "ip_address" "inet" NOT NULL,
    "otp_code" "text",
    "web_authn_session_data" "jsonb"
);


ALTER TABLE "auth"."mfa_challenges" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_challenges" IS 'auth: stores metadata about challenge requests made';



CREATE TABLE IF NOT EXISTS "auth"."mfa_factors" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "friendly_name" "text",
    "factor_type" "auth"."factor_type" NOT NULL,
    "status" "auth"."factor_status" NOT NULL,
    "created_at" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone NOT NULL,
    "secret" "text",
    "phone" "text",
    "last_challenged_at" timestamp with time zone,
    "web_authn_credential" "jsonb",
    "web_authn_aaguid" "uuid",
    "last_webauthn_challenge_data" "jsonb"
);


ALTER TABLE "auth"."mfa_factors" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."mfa_factors" IS 'auth: stores metadata about factors';



COMMENT ON COLUMN "auth"."mfa_factors"."last_webauthn_challenge_data" IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';



CREATE TABLE IF NOT EXISTS "auth"."oauth_authorizations" (
    "id" "uuid" NOT NULL,
    "authorization_id" "text" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "redirect_uri" "text" NOT NULL,
    "scope" "text" NOT NULL,
    "state" "text",
    "resource" "text",
    "code_challenge" "text",
    "code_challenge_method" "auth"."code_challenge_method",
    "response_type" "auth"."oauth_response_type" DEFAULT 'code'::"auth"."oauth_response_type" NOT NULL,
    "status" "auth"."oauth_authorization_status" DEFAULT 'pending'::"auth"."oauth_authorization_status" NOT NULL,
    "authorization_code" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '00:03:00'::interval) NOT NULL,
    "approved_at" timestamp with time zone,
    "nonce" "text",
    CONSTRAINT "oauth_authorizations_authorization_code_length" CHECK (("char_length"("authorization_code") <= 255)),
    CONSTRAINT "oauth_authorizations_code_challenge_length" CHECK (("char_length"("code_challenge") <= 128)),
    CONSTRAINT "oauth_authorizations_expires_at_future" CHECK (("expires_at" > "created_at")),
    CONSTRAINT "oauth_authorizations_nonce_length" CHECK (("char_length"("nonce") <= 255)),
    CONSTRAINT "oauth_authorizations_redirect_uri_length" CHECK (("char_length"("redirect_uri") <= 2048)),
    CONSTRAINT "oauth_authorizations_resource_length" CHECK (("char_length"("resource") <= 2048)),
    CONSTRAINT "oauth_authorizations_scope_length" CHECK (("char_length"("scope") <= 4096)),
    CONSTRAINT "oauth_authorizations_state_length" CHECK (("char_length"("state") <= 4096))
);


ALTER TABLE "auth"."oauth_authorizations" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_client_states" (
    "id" "uuid" NOT NULL,
    "provider_type" "text" NOT NULL,
    "code_verifier" "text",
    "created_at" timestamp with time zone NOT NULL
);


ALTER TABLE "auth"."oauth_client_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."oauth_client_states" IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';



CREATE TABLE IF NOT EXISTS "auth"."oauth_clients" (
    "id" "uuid" NOT NULL,
    "client_secret_hash" "text",
    "registration_type" "auth"."oauth_registration_type" NOT NULL,
    "redirect_uris" "text" NOT NULL,
    "grant_types" "text" NOT NULL,
    "client_name" "text",
    "client_uri" "text",
    "logo_uri" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "client_type" "auth"."oauth_client_type" DEFAULT 'confidential'::"auth"."oauth_client_type" NOT NULL,
    "token_endpoint_auth_method" "text" NOT NULL,
    CONSTRAINT "oauth_clients_client_name_length" CHECK (("char_length"("client_name") <= 1024)),
    CONSTRAINT "oauth_clients_client_uri_length" CHECK (("char_length"("client_uri") <= 2048)),
    CONSTRAINT "oauth_clients_logo_uri_length" CHECK (("char_length"("logo_uri") <= 2048)),
    CONSTRAINT "oauth_clients_token_endpoint_auth_method_check" CHECK (("token_endpoint_auth_method" = ANY (ARRAY['client_secret_basic'::"text", 'client_secret_post'::"text", 'none'::"text"])))
);


ALTER TABLE "auth"."oauth_clients" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."oauth_consents" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "client_id" "uuid" NOT NULL,
    "scopes" "text" NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "oauth_consents_revoked_after_granted" CHECK ((("revoked_at" IS NULL) OR ("revoked_at" >= "granted_at"))),
    CONSTRAINT "oauth_consents_scopes_length" CHECK (("char_length"("scopes") <= 2048)),
    CONSTRAINT "oauth_consents_scopes_not_empty" CHECK (("char_length"(TRIM(BOTH FROM "scopes")) > 0))
);


ALTER TABLE "auth"."oauth_consents" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."one_time_tokens" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token_type" "auth"."one_time_token_type" NOT NULL,
    "token_hash" "text" NOT NULL,
    "relates_to" "text" NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "one_time_tokens_token_hash_check" CHECK (("char_length"("token_hash") > 0))
);


ALTER TABLE "auth"."one_time_tokens" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."refresh_tokens" (
    "instance_id" "uuid",
    "id" bigint NOT NULL,
    "token" character varying(255),
    "user_id" character varying(255),
    "revoked" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "parent" character varying(255),
    "session_id" "uuid"
);


ALTER TABLE "auth"."refresh_tokens" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."refresh_tokens" IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';



CREATE SEQUENCE IF NOT EXISTS "auth"."refresh_tokens_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNER TO "supabase_auth_admin";


ALTER SEQUENCE "auth"."refresh_tokens_id_seq" OWNED BY "auth"."refresh_tokens"."id";



CREATE TABLE IF NOT EXISTS "auth"."saml_providers" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "entity_id" "text" NOT NULL,
    "metadata_xml" "text" NOT NULL,
    "metadata_url" "text",
    "attribute_mapping" "jsonb",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "name_id_format" "text",
    CONSTRAINT "entity_id not empty" CHECK (("char_length"("entity_id") > 0)),
    CONSTRAINT "metadata_url not empty" CHECK ((("metadata_url" = NULL::"text") OR ("char_length"("metadata_url") > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK (("char_length"("metadata_xml") > 0))
);


ALTER TABLE "auth"."saml_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_providers" IS 'Auth: Manages SAML Identity Provider connections.';



CREATE TABLE IF NOT EXISTS "auth"."saml_relay_states" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "request_id" "text" NOT NULL,
    "for_email" "text",
    "redirect_to" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "flow_state_id" "uuid",
    CONSTRAINT "request_id not empty" CHECK (("char_length"("request_id") > 0))
);


ALTER TABLE "auth"."saml_relay_states" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."saml_relay_states" IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';



CREATE TABLE IF NOT EXISTS "auth"."schema_migrations" (
    "version" character varying(255) NOT NULL
);


ALTER TABLE "auth"."schema_migrations" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."schema_migrations" IS 'Auth: Manages updates to the auth system.';



CREATE TABLE IF NOT EXISTS "auth"."sessions" (
    "id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "factor_id" "uuid",
    "aal" "auth"."aal_level",
    "not_after" timestamp with time zone,
    "refreshed_at" timestamp without time zone,
    "user_agent" "text",
    "ip" "inet",
    "tag" "text",
    "oauth_client_id" "uuid",
    "refresh_token_hmac_key" "text",
    "refresh_token_counter" bigint,
    "scopes" "text",
    CONSTRAINT "sessions_scopes_length" CHECK (("char_length"("scopes") <= 4096))
);


ALTER TABLE "auth"."sessions" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sessions" IS 'Auth: Stores session data associated to a user.';



COMMENT ON COLUMN "auth"."sessions"."not_after" IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_hmac_key" IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';



COMMENT ON COLUMN "auth"."sessions"."refresh_token_counter" IS 'Holds the ID (counter) of the last issued refresh token.';



CREATE TABLE IF NOT EXISTS "auth"."sso_domains" (
    "id" "uuid" NOT NULL,
    "sso_provider_id" "uuid" NOT NULL,
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK (("char_length"("domain") > 0))
);


ALTER TABLE "auth"."sso_domains" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_domains" IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';



CREATE TABLE IF NOT EXISTS "auth"."sso_providers" (
    "id" "uuid" NOT NULL,
    "resource_id" "text",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "disabled" boolean,
    CONSTRAINT "resource_id not empty" CHECK ((("resource_id" = NULL::"text") OR ("char_length"("resource_id") > 0)))
);


ALTER TABLE "auth"."sso_providers" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."sso_providers" IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';



COMMENT ON COLUMN "auth"."sso_providers"."resource_id" IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';



CREATE TABLE IF NOT EXISTS "auth"."users" (
    "instance_id" "uuid",
    "id" "uuid" NOT NULL,
    "aud" character varying(255),
    "role" character varying(255),
    "email" character varying(255),
    "encrypted_password" character varying(255),
    "email_confirmed_at" timestamp with time zone,
    "invited_at" timestamp with time zone,
    "confirmation_token" character varying(255),
    "confirmation_sent_at" timestamp with time zone,
    "recovery_token" character varying(255),
    "recovery_sent_at" timestamp with time zone,
    "email_change_token_new" character varying(255),
    "email_change" character varying(255),
    "email_change_sent_at" timestamp with time zone,
    "last_sign_in_at" timestamp with time zone,
    "raw_app_meta_data" "jsonb",
    "raw_user_meta_data" "jsonb",
    "is_super_admin" boolean,
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone,
    "phone" "text" DEFAULT NULL::character varying,
    "phone_confirmed_at" timestamp with time zone,
    "phone_change" "text" DEFAULT ''::character varying,
    "phone_change_token" character varying(255) DEFAULT ''::character varying,
    "phone_change_sent_at" timestamp with time zone,
    "confirmed_at" timestamp with time zone GENERATED ALWAYS AS (LEAST("email_confirmed_at", "phone_confirmed_at")) STORED,
    "email_change_token_current" character varying(255) DEFAULT ''::character varying,
    "email_change_confirm_status" smallint DEFAULT 0,
    "banned_until" timestamp with time zone,
    "reauthentication_token" character varying(255) DEFAULT ''::character varying,
    "reauthentication_sent_at" timestamp with time zone,
    "is_sso_user" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "is_anonymous" boolean DEFAULT false NOT NULL,
    CONSTRAINT "users_email_change_confirm_status_check" CHECK ((("email_change_confirm_status" >= 0) AND ("email_change_confirm_status" <= 2)))
);


ALTER TABLE "auth"."users" OWNER TO "supabase_auth_admin";


COMMENT ON TABLE "auth"."users" IS 'Auth: Stores user login data within a secure schema.';



COMMENT ON COLUMN "auth"."users"."is_sso_user" IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';



CREATE TABLE IF NOT EXISTS "auth"."webauthn_challenges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "challenge_type" "text" NOT NULL,
    "session_data" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    CONSTRAINT "webauthn_challenges_challenge_type_check" CHECK (("challenge_type" = ANY (ARRAY['signup'::"text", 'registration'::"text", 'authentication'::"text"])))
);


ALTER TABLE "auth"."webauthn_challenges" OWNER TO "supabase_auth_admin";


CREATE TABLE IF NOT EXISTS "auth"."webauthn_credentials" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "credential_id" "bytea" NOT NULL,
    "public_key" "bytea" NOT NULL,
    "attestation_type" "text" DEFAULT ''::"text" NOT NULL,
    "aaguid" "uuid",
    "sign_count" bigint DEFAULT 0 NOT NULL,
    "transports" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "backup_eligible" boolean DEFAULT false NOT NULL,
    "backed_up" boolean DEFAULT false NOT NULL,
    "friendly_name" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_used_at" timestamp with time zone
);


ALTER TABLE "auth"."webauthn_credentials" OWNER TO "supabase_auth_admin";


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


CREATE TABLE IF NOT EXISTS "public"."campaign_rate_limits" (
    "waba_id" "text" NOT NULL,
    "paused_until" timestamp with time zone NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."campaign_rate_limits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_worker_claims" (
    "campaign_id" "text" NOT NULL,
    "worker_id" "text" NOT NULL,
    "claimed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."campaign_worker_claims" OWNER TO "postgres";


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
    "last_active" timestamp with time zone DEFAULT "now"(),
    "is_blocked" boolean DEFAULT false
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


CREATE TABLE IF NOT EXISTS "public"."drip_campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text",
    "trigger_type" "text",
    "trigger_value" "text",
    "status" "text" DEFAULT 'DRAFT'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "enrollment_count" integer DEFAULT 0,
    "allowed_days" "text" DEFAULT '0,1,2,3,4,5,6'::"text",
    "time_window_start" time without time zone DEFAULT '09:00:00'::time without time zone,
    "time_window_end" time without time zone DEFAULT '18:00:00'::time without time zone,
    "stop_on_reply" boolean DEFAULT true,
    "allow_reentry" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "drip_campaigns_trigger_type_check" CHECK (("trigger_type" = ANY (ARRAY['TAG_ADDED'::"text", 'PIPELINE_STAGE_CHANGED'::"text", 'MANUAL'::"text"])))
);


ALTER TABLE "public"."drip_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drip_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "drip_enrollment_id" "uuid",
    "contact_id" "uuid",
    "action_type" "text" NOT NULL,
    "campaign_name" "text",
    "step_order" integer,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "idempotency_key" "text",
    "status" "text" DEFAULT 'SUCCESS'::"text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."drip_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."drip_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "drip_campaign_id" "uuid",
    "step_order" integer NOT NULL,
    "step_type" "text",
    "step_config" "jsonb",
    "delay_hours" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "delay_value" integer DEFAULT 0,
    "delay_unit" "text" DEFAULT 'HOURS'::"text",
    "use_custom_schedule" boolean DEFAULT false,
    "custom_allowed_days" "text",
    "custom_time_start" time without time zone,
    "custom_time_end" time without time zone,
    CONSTRAINT "drip_steps_step_type_check" CHECK (("step_type" = ANY (ARRAY['WHATSAPP_MESSAGE'::"text", 'EMAIL'::"text", 'WAIT'::"text", 'CONDITION'::"text", 'AI_INTENT'::"text"])))
);


ALTER TABLE "public"."drip_steps" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."follow_ups" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "contact_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "scheduled_at" timestamp with time zone NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text",
    "priority" "text" DEFAULT 'MEDIUM'::"text",
    "type" "text" DEFAULT 'CALL'::"text",
    "recurrence_rule" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "timezone" "text" DEFAULT 'Asia/Kolkata'::"text",
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."follow_ups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_campaigns" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "status" "text" DEFAULT 'active'::"text",
    "trigger_type" "text" DEFAULT 'manual'::"text",
    "trigger_config" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."followup_campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_enrollments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'active'::"text",
    "current_step_order" integer DEFAULT '-1'::integer,
    "next_run_at" timestamp with time zone,
    "completed_steps" "jsonb" DEFAULT '[]'::"jsonb",
    "custom_data" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."followup_enrollments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "enrollment_id" "uuid" NOT NULL,
    "step_id" "uuid",
    "status" "text" DEFAULT 'sent'::"text",
    "message_id" "text",
    "error_message" "text",
    "executed_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."followup_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."followup_steps" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "template_id" "uuid",
    "step_order" integer DEFAULT 0,
    "delay_days" integer DEFAULT 0,
    "delay_hours" integer DEFAULT 0,
    "delay_minutes" integer DEFAULT 0,
    "time_of_day" time without time zone,
    "offset_type" "text" DEFAULT 'start'::"text",
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."followup_steps" OWNER TO "postgres";


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
    "api_access_enabled" boolean DEFAULT false,
    "domain" "text" DEFAULT 'clickube.com'::"text"
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
    "last_notification_sent_at" timestamp with time zone,
    "plan_assigned_by_admin" boolean DEFAULT false
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


COMMENT ON COLUMN "public"."profiles"."plan_assigned_by_admin" IS 'TRUE when a Tenant/Super Admin has explicitly assigned a paid plan. When TRUE, Tenant Admin cannot delete the user.';



CREATE TABLE IF NOT EXISTS "public"."quick_replies" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "nodes" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "edges" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."quick_replies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sheet_automation_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "automation_id" "uuid",
    "row_hash" "text" NOT NULL,
    "phone_number" "text",
    "status" "text" DEFAULT 'sent'::"text",
    "sent_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "meta" "jsonb" DEFAULT '{}'::"jsonb"
);


ALTER TABLE "public"."sheet_automation_history" OWNER TO "postgres";


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
    "connection_id" "text",
    "error_log" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "flow_id" "uuid",
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


CREATE TABLE IF NOT EXISTS "public"."template_components_cache" (
    "user_id" "text" NOT NULL,
    "template_name" "text" NOT NULL,
    "components" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."template_components_cache" OWNER TO "postgres";


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
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "api_key" "text"
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
    "quality_score" "text" DEFAULT 'UNKNOWN'::"text",
    "last_synced_at" timestamp with time zone
);


ALTER TABLE "public"."whatsapp_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "realtime"."messages" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
)
PARTITION BY RANGE ("inserted_at");


ALTER TABLE "realtime"."messages" OWNER TO "supabase_realtime_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_07" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_07" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_08" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_08" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_09" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_09" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_10" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_10" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_11" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_11" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_12" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_12" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."messages_2026_05_13" (
    "topic" "text" NOT NULL,
    "extension" "text" NOT NULL,
    "payload" "jsonb",
    "event" "text",
    "private" boolean DEFAULT false,
    "updated_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "inserted_at" timestamp without time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "realtime"."messages_2026_05_13" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."schema_migrations" (
    "version" bigint NOT NULL,
    "inserted_at" timestamp(0) without time zone
);


ALTER TABLE "realtime"."schema_migrations" OWNER TO "supabase_admin";


CREATE TABLE IF NOT EXISTS "realtime"."subscription" (
    "id" bigint NOT NULL,
    "subscription_id" "uuid" NOT NULL,
    "entity" "regclass" NOT NULL,
    "filters" "realtime"."user_defined_filter"[] DEFAULT '{}'::"realtime"."user_defined_filter"[] NOT NULL,
    "claims" "jsonb" NOT NULL,
    "claims_role" "regrole" GENERATED ALWAYS AS ("realtime"."to_regrole"(("claims" ->> 'role'::"text"))) STORED NOT NULL,
    "created_at" timestamp without time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "action_filter" "text" DEFAULT '*'::"text",
    CONSTRAINT "subscription_action_filter_check" CHECK (("action_filter" = ANY (ARRAY['*'::"text", 'INSERT'::"text", 'UPDATE'::"text", 'DELETE'::"text"])))
);


ALTER TABLE "realtime"."subscription" OWNER TO "supabase_admin";


ALTER TABLE "realtime"."subscription" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "realtime"."subscription_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "storage"."buckets" (
    "id" "text" NOT NULL,
    "name" "text" NOT NULL,
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "public" boolean DEFAULT false,
    "avif_autodetection" boolean DEFAULT false,
    "file_size_limit" bigint,
    "allowed_mime_types" "text"[],
    "owner_id" "text",
    "type" "storage"."buckettype" DEFAULT 'STANDARD'::"storage"."buckettype" NOT NULL
);


ALTER TABLE "storage"."buckets" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."buckets"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."buckets_analytics" (
    "name" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'ANALYTICS'::"storage"."buckettype" NOT NULL,
    "format" "text" DEFAULT 'ICEBERG'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "deleted_at" timestamp with time zone
);


ALTER TABLE "storage"."buckets_analytics" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."buckets_vectors" (
    "id" "text" NOT NULL,
    "type" "storage"."buckettype" DEFAULT 'VECTOR'::"storage"."buckettype" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."buckets_vectors" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."migrations" (
    "id" integer NOT NULL,
    "name" character varying(100) NOT NULL,
    "hash" character varying(40) NOT NULL,
    "executed_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "storage"."migrations" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."objects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bucket_id" "text",
    "name" "text",
    "owner" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "last_accessed_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb",
    "path_tokens" "text"[] GENERATED ALWAYS AS ("string_to_array"("name", '/'::"text")) STORED,
    "version" "text",
    "owner_id" "text",
    "user_metadata" "jsonb"
);


ALTER TABLE "storage"."objects" OWNER TO "supabase_storage_admin";


COMMENT ON COLUMN "storage"."objects"."owner" IS 'Field is deprecated, use owner_id instead';



CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads" (
    "id" "text" NOT NULL,
    "in_progress_size" bigint DEFAULT 0 NOT NULL,
    "upload_signature" "text" NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "version" "text" NOT NULL,
    "owner_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_metadata" "jsonb",
    "metadata" "jsonb"
);


ALTER TABLE "storage"."s3_multipart_uploads" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."s3_multipart_uploads_parts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "upload_id" "text" NOT NULL,
    "size" bigint DEFAULT 0 NOT NULL,
    "part_number" integer NOT NULL,
    "bucket_id" "text" NOT NULL,
    "key" "text" NOT NULL COLLATE "pg_catalog"."C",
    "etag" "text" NOT NULL,
    "owner_id" "text",
    "version" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."s3_multipart_uploads_parts" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "storage"."vector_indexes" (
    "id" "text" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL COLLATE "pg_catalog"."C",
    "bucket_id" "text" NOT NULL,
    "data_type" "text" NOT NULL,
    "dimension" integer NOT NULL,
    "distance_metric" "text" NOT NULL,
    "metadata_configuration" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "storage"."vector_indexes" OWNER TO "supabase_storage_admin";


CREATE TABLE IF NOT EXISTS "supabase_functions"."hooks" (
    "id" bigint NOT NULL,
    "hook_table_id" integer NOT NULL,
    "hook_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "request_id" bigint
);


ALTER TABLE "supabase_functions"."hooks" OWNER TO "supabase_functions_admin";


COMMENT ON TABLE "supabase_functions"."hooks" IS 'Supabase Functions Hooks: Audit trail for triggered hooks.';



CREATE SEQUENCE IF NOT EXISTS "supabase_functions"."hooks_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "supabase_functions"."hooks_id_seq" OWNER TO "supabase_functions_admin";


ALTER SEQUENCE "supabase_functions"."hooks_id_seq" OWNED BY "supabase_functions"."hooks"."id";



CREATE TABLE IF NOT EXISTS "supabase_functions"."migrations" (
    "version" "text" NOT NULL,
    "inserted_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "supabase_functions"."migrations" OWNER TO "supabase_functions_admin";


ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_07" FOR VALUES FROM ('2026-05-07 00:00:00') TO ('2026-05-08 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_08" FOR VALUES FROM ('2026-05-08 00:00:00') TO ('2026-05-09 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_09" FOR VALUES FROM ('2026-05-09 00:00:00') TO ('2026-05-10 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_10" FOR VALUES FROM ('2026-05-10 00:00:00') TO ('2026-05-11 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_11" FOR VALUES FROM ('2026-05-11 00:00:00') TO ('2026-05-12 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_12" FOR VALUES FROM ('2026-05-12 00:00:00') TO ('2026-05-13 00:00:00');



ALTER TABLE ONLY "realtime"."messages" ATTACH PARTITION "realtime"."messages_2026_05_13" FOR VALUES FROM ('2026-05-13 00:00:00') TO ('2026-05-14 00:00:00');



ALTER TABLE ONLY "auth"."refresh_tokens" ALTER COLUMN "id" SET DEFAULT "nextval"('"auth"."refresh_tokens_id_seq"'::"regclass");



ALTER TABLE ONLY "supabase_functions"."hooks" ALTER COLUMN "id" SET DEFAULT "nextval"('"supabase_functions"."hooks_id_seq"'::"regclass");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "amr_id_pk" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."audit_log_entries"
    ADD CONSTRAINT "audit_log_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_identifier_key" UNIQUE ("identifier");



ALTER TABLE ONLY "auth"."custom_oauth_providers"
    ADD CONSTRAINT "custom_oauth_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."flow_state"
    ADD CONSTRAINT "flow_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_provider_id_provider_unique" UNIQUE ("provider_id", "provider");



ALTER TABLE ONLY "auth"."instances"
    ADD CONSTRAINT "instances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_authentication_method_pkey" UNIQUE ("session_id", "authentication_method");



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_last_challenged_at_key" UNIQUE ("last_challenged_at");



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_code_key" UNIQUE ("authorization_code");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_authorization_id_key" UNIQUE ("authorization_id");



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_client_states"
    ADD CONSTRAINT "oauth_client_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_clients"
    ADD CONSTRAINT "oauth_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_client_unique" UNIQUE ("user_id", "client_id");



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE ("token");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_entity_id_key" UNIQUE ("entity_id");



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."sso_providers"
    ADD CONSTRAINT "sso_providers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "auth"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."campaign_rate_limits"
    ADD CONSTRAINT "campaign_rate_limits_pkey" PRIMARY KEY ("waba_id");



ALTER TABLE ONLY "public"."campaign_worker_claims"
    ADD CONSTRAINT "campaign_worker_claims_pkey" PRIMARY KEY ("campaign_id");



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



ALTER TABLE ONLY "public"."drip_campaigns"
    ADD CONSTRAINT "drip_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drip_enrollments"
    ADD CONSTRAINT "drip_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drip_logs"
    ADD CONSTRAINT "drip_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."drip_steps"
    ADD CONSTRAINT "drip_steps_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."flows"
    ADD CONSTRAINT "flows_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_campaigns"
    ADD CONSTRAINT "followup_campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_enrollments"
    ADD CONSTRAINT "followup_enrollments_contact_id_campaign_id_key" UNIQUE ("contact_id", "campaign_id");



ALTER TABLE ONLY "public"."followup_enrollments"
    ADD CONSTRAINT "followup_enrollments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_logs"
    ADD CONSTRAINT "followup_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."followup_steps"
    ADD CONSTRAINT "followup_steps_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."quick_replies"
    ADD CONSTRAINT "quick_replies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sheet_automation_history"
    ADD CONSTRAINT "sheet_automation_history_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."template_components_cache"
    ADD CONSTRAINT "template_components_cache_pkey" PRIMARY KEY ("user_id", "template_name");



ALTER TABLE ONLY "public"."tenant_limits"
    ADD CONSTRAINT "tenant_limits_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."tenant_plans"
    ADD CONSTRAINT "tenant_plans_pkey" PRIMARY KEY ("domain");



ALTER TABLE ONLY "public"."drip_logs"
    ADD CONSTRAINT "uq_drip_logs_idempotency" UNIQUE ("idempotency_key");



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



ALTER TABLE ONLY "realtime"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_07"
    ADD CONSTRAINT "messages_2026_05_07_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_08"
    ADD CONSTRAINT "messages_2026_05_08_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_09"
    ADD CONSTRAINT "messages_2026_05_09_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_10"
    ADD CONSTRAINT "messages_2026_05_10_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_11"
    ADD CONSTRAINT "messages_2026_05_11_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_12"
    ADD CONSTRAINT "messages_2026_05_12_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."messages_2026_05_13"
    ADD CONSTRAINT "messages_2026_05_13_pkey" PRIMARY KEY ("id", "inserted_at");



ALTER TABLE ONLY "realtime"."subscription"
    ADD CONSTRAINT "pk_subscription" PRIMARY KEY ("id");



ALTER TABLE ONLY "realtime"."schema_migrations"
    ADD CONSTRAINT "schema_migrations_pkey" PRIMARY KEY ("version");



ALTER TABLE ONLY "storage"."buckets_analytics"
    ADD CONSTRAINT "buckets_analytics_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets"
    ADD CONSTRAINT "buckets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."buckets_vectors"
    ADD CONSTRAINT "buckets_vectors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_name_key" UNIQUE ("name");



ALTER TABLE ONLY "storage"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "supabase_functions"."hooks"
    ADD CONSTRAINT "hooks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "supabase_functions"."migrations"
    ADD CONSTRAINT "migrations_pkey" PRIMARY KEY ("version");



CREATE INDEX "audit_logs_instance_id_idx" ON "auth"."audit_log_entries" USING "btree" ("instance_id");



CREATE UNIQUE INDEX "confirmation_token_idx" ON "auth"."users" USING "btree" ("confirmation_token") WHERE (("confirmation_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "custom_oauth_providers_created_at_idx" ON "auth"."custom_oauth_providers" USING "btree" ("created_at");



CREATE INDEX "custom_oauth_providers_enabled_idx" ON "auth"."custom_oauth_providers" USING "btree" ("enabled");



CREATE INDEX "custom_oauth_providers_identifier_idx" ON "auth"."custom_oauth_providers" USING "btree" ("identifier");



CREATE INDEX "custom_oauth_providers_provider_type_idx" ON "auth"."custom_oauth_providers" USING "btree" ("provider_type");



CREATE UNIQUE INDEX "email_change_token_current_idx" ON "auth"."users" USING "btree" ("email_change_token_current") WHERE (("email_change_token_current")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "email_change_token_new_idx" ON "auth"."users" USING "btree" ("email_change_token_new") WHERE (("email_change_token_new")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "factor_id_created_at_idx" ON "auth"."mfa_factors" USING "btree" ("user_id", "created_at");



CREATE INDEX "flow_state_created_at_idx" ON "auth"."flow_state" USING "btree" ("created_at" DESC);



CREATE INDEX "identities_email_idx" ON "auth"."identities" USING "btree" ("email" "text_pattern_ops");



COMMENT ON INDEX "auth"."identities_email_idx" IS 'Auth: Ensures indexed queries on the email column';



CREATE INDEX "identities_user_id_idx" ON "auth"."identities" USING "btree" ("user_id");



CREATE INDEX "idx_auth_code" ON "auth"."flow_state" USING "btree" ("auth_code");



CREATE INDEX "idx_oauth_client_states_created_at" ON "auth"."oauth_client_states" USING "btree" ("created_at");



CREATE INDEX "idx_user_id_auth_method" ON "auth"."flow_state" USING "btree" ("user_id", "authentication_method");



CREATE INDEX "mfa_challenge_created_at_idx" ON "auth"."mfa_challenges" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "mfa_factors_user_friendly_name_unique" ON "auth"."mfa_factors" USING "btree" ("friendly_name", "user_id") WHERE (TRIM(BOTH FROM "friendly_name") <> ''::"text");



CREATE INDEX "mfa_factors_user_id_idx" ON "auth"."mfa_factors" USING "btree" ("user_id");



CREATE INDEX "oauth_auth_pending_exp_idx" ON "auth"."oauth_authorizations" USING "btree" ("expires_at") WHERE ("status" = 'pending'::"auth"."oauth_authorization_status");



CREATE INDEX "oauth_clients_deleted_at_idx" ON "auth"."oauth_clients" USING "btree" ("deleted_at");



CREATE INDEX "oauth_consents_active_client_idx" ON "auth"."oauth_consents" USING "btree" ("client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_active_user_client_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "client_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "oauth_consents_user_order_idx" ON "auth"."oauth_consents" USING "btree" ("user_id", "granted_at" DESC);



CREATE INDEX "one_time_tokens_relates_to_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("relates_to");



CREATE INDEX "one_time_tokens_token_hash_hash_idx" ON "auth"."one_time_tokens" USING "hash" ("token_hash");



CREATE UNIQUE INDEX "one_time_tokens_user_id_token_type_key" ON "auth"."one_time_tokens" USING "btree" ("user_id", "token_type");



CREATE UNIQUE INDEX "reauthentication_token_idx" ON "auth"."users" USING "btree" ("reauthentication_token") WHERE (("reauthentication_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE UNIQUE INDEX "recovery_token_idx" ON "auth"."users" USING "btree" ("recovery_token") WHERE (("recovery_token")::"text" !~ '^[0-9 ]*$'::"text");



CREATE INDEX "refresh_tokens_instance_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id");



CREATE INDEX "refresh_tokens_instance_id_user_id_idx" ON "auth"."refresh_tokens" USING "btree" ("instance_id", "user_id");



CREATE INDEX "refresh_tokens_parent_idx" ON "auth"."refresh_tokens" USING "btree" ("parent");



CREATE INDEX "refresh_tokens_session_id_revoked_idx" ON "auth"."refresh_tokens" USING "btree" ("session_id", "revoked");



CREATE INDEX "refresh_tokens_updated_at_idx" ON "auth"."refresh_tokens" USING "btree" ("updated_at" DESC);



CREATE INDEX "saml_providers_sso_provider_id_idx" ON "auth"."saml_providers" USING "btree" ("sso_provider_id");



CREATE INDEX "saml_relay_states_created_at_idx" ON "auth"."saml_relay_states" USING "btree" ("created_at" DESC);



CREATE INDEX "saml_relay_states_for_email_idx" ON "auth"."saml_relay_states" USING "btree" ("for_email");



CREATE INDEX "saml_relay_states_sso_provider_id_idx" ON "auth"."saml_relay_states" USING "btree" ("sso_provider_id");



CREATE INDEX "sessions_not_after_idx" ON "auth"."sessions" USING "btree" ("not_after" DESC);



CREATE INDEX "sessions_oauth_client_id_idx" ON "auth"."sessions" USING "btree" ("oauth_client_id");



CREATE INDEX "sessions_user_id_idx" ON "auth"."sessions" USING "btree" ("user_id");



CREATE UNIQUE INDEX "sso_domains_domain_idx" ON "auth"."sso_domains" USING "btree" ("lower"("domain"));



CREATE INDEX "sso_domains_sso_provider_id_idx" ON "auth"."sso_domains" USING "btree" ("sso_provider_id");



CREATE UNIQUE INDEX "sso_providers_resource_id_idx" ON "auth"."sso_providers" USING "btree" ("lower"("resource_id"));



CREATE INDEX "sso_providers_resource_id_pattern_idx" ON "auth"."sso_providers" USING "btree" ("resource_id" "text_pattern_ops");



CREATE UNIQUE INDEX "unique_phone_factor_per_user" ON "auth"."mfa_factors" USING "btree" ("user_id", "phone");



CREATE INDEX "user_id_created_at_idx" ON "auth"."sessions" USING "btree" ("user_id", "created_at");



CREATE UNIQUE INDEX "users_email_partial_key" ON "auth"."users" USING "btree" ("email") WHERE ("is_sso_user" = false);



COMMENT ON INDEX "auth"."users_email_partial_key" IS 'Auth: A partial unique index that applies only when is_sso_user is false';



CREATE INDEX "users_instance_id_email_idx" ON "auth"."users" USING "btree" ("instance_id", "lower"(("email")::"text"));



CREATE INDEX "users_instance_id_idx" ON "auth"."users" USING "btree" ("instance_id");



CREATE INDEX "users_is_anonymous_idx" ON "auth"."users" USING "btree" ("is_anonymous");



CREATE INDEX "webauthn_challenges_expires_at_idx" ON "auth"."webauthn_challenges" USING "btree" ("expires_at");



CREATE INDEX "webauthn_challenges_user_id_idx" ON "auth"."webauthn_challenges" USING "btree" ("user_id");



CREATE UNIQUE INDEX "webauthn_credentials_credential_id_key" ON "auth"."webauthn_credentials" USING "btree" ("credential_id");



CREATE INDEX "webauthn_credentials_user_id_idx" ON "auth"."webauthn_credentials" USING "btree" ("user_id");



CREATE INDEX "idx_appointments_lead_history" ON "public"."appointments" USING "btree" ("lead_id", "start_time" DESC);



CREATE INDEX "idx_appointments_lead_id" ON "public"."appointments" USING "btree" ("lead_id");



CREATE INDEX "idx_appointments_start_time" ON "public"."appointments" USING "btree" ("start_time");



CREATE INDEX "idx_appointments_user_date" ON "public"."appointments" USING "btree" ("user_id", "start_time" DESC);



CREATE INDEX "idx_appointments_user_id" ON "public"."appointments" USING "btree" ("user_id");



CREATE INDEX "idx_appointments_user_start" ON "public"."appointments" USING "btree" ("user_id", "start_time");



CREATE INDEX "idx_call_logs_called_at" ON "public"."call_logs" USING "btree" ("called_at" DESC);



CREATE INDEX "idx_call_logs_lead_history" ON "public"."call_logs" USING "btree" ("lead_id", "called_at" DESC);



CREATE INDEX "idx_call_logs_lead_id" ON "public"."call_logs" USING "btree" ("lead_id");



CREATE INDEX "idx_call_logs_user_date" ON "public"."call_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_call_logs_user_id" ON "public"."call_logs" USING "btree" ("user_id");



CREATE INDEX "idx_campaign_queue_completion" ON "public"."campaign_queue" USING "btree" ("campaign_id", "status");



CREATE INDEX "idx_campaign_queue_message_id" ON "public"."campaign_queue" USING "btree" ("message_id") WHERE ("message_id" IS NOT NULL);



CREATE INDEX "idx_campaign_queue_report_stats" ON "public"."campaign_queue" USING "btree" ("campaign_id", "status") INCLUDE ("id");



CREATE INDEX "idx_campaign_queue_stale_lock" ON "public"."campaign_queue" USING "btree" ("status", "updated_at") WHERE ("status" = 'SENDING'::"text");



CREATE INDEX "idx_campaign_queue_status_updated" ON "public"."campaign_queue" USING "btree" ("status", "updated_at");



CREATE INDEX "idx_campaign_queue_ui_list" ON "public"."campaign_queue" USING "btree" ("campaign_id", "updated_at" DESC);



CREATE INDEX "idx_campaign_queue_worker_fetch" ON "public"."campaign_queue" USING "btree" ("campaign_id", "status", "id");



CREATE INDEX "idx_campaign_rate_limits_until" ON "public"."campaign_rate_limits" USING "btree" ("paused_until");



CREATE INDEX "idx_campaigns_processing" ON "public"."campaigns" USING "btree" ("status") WHERE ("status" = 'PROCESSING'::"text");



CREATE INDEX "idx_campaigns_scheduled" ON "public"."campaigns" USING "btree" ("user_id", "scheduled_at") WHERE ("scheduled_at" IS NOT NULL);



CREATE INDEX "idx_campaigns_status_scheduled" ON "public"."campaigns" USING "btree" ("status", "scheduled_at") WHERE (("status" = 'SCHEDULED'::"text") AND ("scheduled_at" IS NOT NULL));



CREATE INDEX "idx_campaigns_user_created" ON "public"."campaigns" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_campaigns_user_id" ON "public"."campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_campaigns_user_status" ON "public"."campaigns" USING "btree" ("user_id", "status");



CREATE INDEX "idx_contact_groups_user_created" ON "public"."contact_groups" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_contact_groups_user_id" ON "public"."contact_groups" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_created_at_desc" ON "public"."contacts" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_contacts_custom_data_gin" ON "public"."contacts" USING "gin" ("custom_data");



CREATE INDEX "idx_contacts_email" ON "public"."contacts" USING "btree" ("email");



CREATE INDEX "idx_contacts_groups_gin" ON "public"."contacts" USING "gin" ("group_ids");



CREATE INDEX "idx_contacts_phone" ON "public"."contacts" USING "btree" ("phone");



CREATE INDEX "idx_contacts_phone_user" ON "public"."contacts" USING "btree" ("phone", "user_id");



CREATE INDEX "idx_contacts_search_trgm" ON "public"."contacts" USING "gin" ("name" "extensions"."gin_trgm_ops", "phone" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_contacts_tags_gin" ON "public"."contacts" USING "gin" ("tags");



CREATE INDEX "idx_contacts_tags_phone" ON "public"."contacts" USING "gin" ("tags") WHERE ("tags" IS NOT NULL);



CREATE INDEX "idx_contacts_user_created" ON "public"."contacts" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_contacts_user_id" ON "public"."contacts" USING "btree" ("user_id");



CREATE INDEX "idx_contacts_user_phone" ON "public"."contacts" USING "btree" ("user_id", "phone");



CREATE INDEX "idx_contacts_user_phone_lookup" ON "public"."contacts" USING "btree" ("user_id", "phone");



CREATE INDEX "idx_conversations_perf_sort" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conversations_status_updated" ON "public"."conversations" USING "btree" ("user_id", "status", "updated_at" DESC);



CREATE INDEX "idx_conversations_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conversations_user_id" ON "public"."conversations" USING "btree" ("user_id");



CREATE INDEX "idx_conversations_user_id_updated_at" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_conversations_user_phone" ON "public"."conversations" USING "btree" ("user_id", "contact_phone");



CREATE INDEX "idx_conversations_user_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);



COMMENT ON INDEX "public"."idx_conversations_user_updated" IS 'Optimizes conversation list loading';



CREATE INDEX "idx_custom_fields_user_id" ON "public"."custom_fields" USING "btree" ("user_id");



CREATE INDEX "idx_drip_campaigns_lookup" ON "public"."drip_campaigns" USING "btree" ("id", "user_id");



CREATE INDEX "idx_drip_campaigns_trigger_lookup" ON "public"."drip_campaigns" USING "btree" ("user_id", "status", "trigger_type", "trigger_value") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "idx_drip_campaigns_user_id" ON "public"."drip_campaigns" USING "btree" ("user_id");



CREATE INDEX "idx_drip_enrollments_campaign_id" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id");



CREATE INDEX "idx_drip_enrollments_campaign_perf" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id", "started_at" DESC, "status");



CREATE INDEX "idx_drip_enrollments_campaign_started" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id", "started_at" DESC, "status");



CREATE INDEX "idx_drip_enrollments_campaign_status" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id", "status");



CREATE INDEX "idx_drip_enrollments_contact_id" ON "public"."drip_enrollments" USING "btree" ("contact_id");



CREATE INDEX "idx_drip_enrollments_current_step" ON "public"."drip_enrollments" USING "btree" ("current_step_id");



CREATE INDEX "idx_drip_enrollments_duplicate_guard" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id", "contact_id", "status") WHERE ("status" = ANY (ARRAY['ACTIVE'::"text", 'PROCESSING'::"text"]));



CREATE INDEX "idx_drip_enrollments_engine_locking" ON "public"."drip_enrollments" USING "btree" ("status", "next_run_at") WHERE ("status" = 'ACTIVE'::"text");



CREATE INDEX "idx_drip_enrollments_next_run" ON "public"."drip_enrollments" USING "btree" ("next_run_at");



CREATE INDEX "idx_drip_enrollments_ui_list" ON "public"."drip_enrollments" USING "btree" ("drip_campaign_id", "started_at" DESC);



CREATE INDEX "idx_drip_logs_enrollment" ON "public"."drip_logs" USING "btree" ("drip_enrollment_id");



CREATE INDEX "idx_drip_logs_idempotency" ON "public"."drip_logs" USING "btree" ("idempotency_key");



CREATE INDEX "idx_drip_logs_idempotency_v2" ON "public"."drip_logs" USING "btree" ("idempotency_key") WHERE ("idempotency_key" IS NOT NULL);



CREATE INDEX "idx_drip_steps_campaign_id" ON "public"."drip_steps" USING "btree" ("drip_campaign_id");



CREATE INDEX "idx_drip_steps_campaign_order" ON "public"."drip_steps" USING "btree" ("drip_campaign_id", "step_order");



CREATE INDEX "idx_flow_sessions_active" ON "public"."flow_sessions" USING "btree" ("contact_phone", "status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_flow_sessions_contact_active" ON "public"."flow_sessions" USING "btree" ("contact_phone") WHERE ("status" = ANY (ARRAY['active'::"text", 'waiting_input'::"text", 'processing'::"text", 'delayed'::"text"]));



CREATE INDEX "idx_flow_sessions_distributed_lock" ON "public"."flow_sessions" USING "btree" ("status", "last_interaction_at", "current_node_id");



CREATE INDEX "idx_flow_sessions_interaction" ON "public"."flow_sessions" USING "btree" ("last_interaction_at");



CREATE INDEX "idx_flow_sessions_lookup_phone" ON "public"."flow_sessions" USING "btree" ("contact_phone", "status");



CREATE UNIQUE INDEX "idx_flow_sessions_one_active" ON "public"."flow_sessions" USING "btree" ("user_id", "contact_phone") WHERE ("status" = ANY (ARRAY['active'::"text", 'waiting_input'::"text", 'processing'::"text", 'delayed'::"text"]));



CREATE INDEX "idx_flow_sessions_scheduler" ON "public"."flow_sessions" USING "btree" ("status", "last_interaction_at");



CREATE INDEX "idx_flow_submissions_user_recent" ON "public"."whatsapp_flow_submissions" USING "btree" ("user_id", "submitted_at" DESC);



CREATE INDEX "idx_flows_keywords" ON "public"."flows" USING "gin" ("trigger_keywords");



CREATE INDEX "idx_flows_keywords_gin" ON "public"."flows" USING "gin" ("trigger_keywords");



CREATE INDEX "idx_flows_user_id" ON "public"."flows" USING "btree" ("user_id");



CREATE INDEX "idx_flows_user_updated" ON "public"."flows" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_follow_ups_contact_history" ON "public"."follow_ups" USING "btree" ("contact_id", "created_at" DESC);



CREATE INDEX "idx_follow_ups_user_schedule" ON "public"."follow_ups" USING "btree" ("user_id", "status", "scheduled_at");



CREATE INDEX "idx_followup_enrollments_contact_id" ON "public"."followup_enrollments" USING "btree" ("contact_id");



CREATE INDEX "idx_followup_enrollments_next_run" ON "public"."followup_enrollments" USING "btree" ("next_run_at") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_followup_steps_campaign_id" ON "public"."followup_steps" USING "btree" ("campaign_id");



CREATE INDEX "idx_form_submissions_form_id" ON "public"."form_submissions" USING "btree" ("form_id");



CREATE INDEX "idx_form_submissions_form_recent" ON "public"."form_submissions" USING "btree" ("form_id", "submitted_at" DESC);



CREATE INDEX "idx_form_submissions_lead_history" ON "public"."form_submissions" USING "btree" ("lead_id", "submitted_at" DESC);



CREATE INDEX "idx_form_submissions_lead_id" ON "public"."form_submissions" USING "btree" ("lead_id");



CREATE INDEX "idx_forms_form_token" ON "public"."forms" USING "btree" ("form_token");



CREATE INDEX "idx_forms_pipeline_id" ON "public"."forms" USING "btree" ("pipeline_id");



CREATE INDEX "idx_forms_token" ON "public"."forms" USING "btree" ("form_token");



CREATE INDEX "idx_forms_user_id" ON "public"."forms" USING "btree" ("user_id");



CREATE INDEX "idx_leads_created_at" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_email" ON "public"."leads" USING "btree" ("email");



CREATE INDEX "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");



CREATE INDEX "idx_leads_pipeline_id" ON "public"."leads" USING "btree" ("pipeline_id");



CREATE INDEX "idx_leads_pipeline_stage" ON "public"."leads" USING "btree" ("pipeline_id", "stage_id");



CREATE INDEX "idx_leads_pipeline_stage_created" ON "public"."leads" USING "btree" ("pipeline_id", "stage_id", "created_at" DESC);



CREATE INDEX "idx_leads_pipeline_stage_val" ON "public"."leads" USING "btree" ("user_id", "pipeline_id", "stage_id") INCLUDE ("estimated_value");



CREATE INDEX "idx_leads_search_trgm" ON "public"."leads" USING "gin" ("name" "extensions"."gin_trgm_ops", "email" "extensions"."gin_trgm_ops", "phone" "extensions"."gin_trgm_ops");



CREATE INDEX "idx_leads_source_user" ON "public"."leads" USING "btree" ("user_id", "source");



CREATE INDEX "idx_leads_stage_id" ON "public"."leads" USING "btree" ("stage_id");



CREATE INDEX "idx_leads_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_tags_gin" ON "public"."leads" USING "gin" ("tags");



CREATE INDEX "idx_leads_updated_at_desc" ON "public"."leads" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_leads_user_created_analytics" ON "public"."leads" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_leads_user_created_at" ON "public"."leads" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_leads_user_created_at_desc" ON "public"."leads" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_leads_user_id" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_leads_user_phone" ON "public"."leads" USING "btree" ("user_id", "phone");



CREATE INDEX "idx_leads_user_pipeline" ON "public"."leads" USING "btree" ("user_id", "pipeline_id");



CREATE INDEX "idx_leads_user_pipeline_stage" ON "public"."leads" USING "btree" ("user_id", "pipeline_id", "stage_id");



CREATE INDEX "idx_leads_user_source" ON "public"."leads" USING "btree" ("user_id", "source");



CREATE INDEX "idx_leads_user_stage" ON "public"."leads" USING "btree" ("user_id", "stage_id");



CREATE INDEX "idx_leads_user_status" ON "public"."leads" USING "btree" ("user_id", "status");



CREATE INDEX "idx_leads_user_tags" ON "public"."leads" USING "btree" ("user_id");



CREATE INDEX "idx_messages_conversation_created" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



COMMENT ON INDEX "public"."idx_messages_conversation_created" IS 'Optimizes message fetching for inbox conversations';



CREATE INDEX "idx_messages_conversation_direction_status" ON "public"."messages" USING "btree" ("conversation_id", "direction", "status");



COMMENT ON INDEX "public"."idx_messages_conversation_direction_status" IS 'Optimizes unread message counting';



CREATE INDEX "idx_messages_conversation_id" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_conversation_id_created_at" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);



CREATE INDEX "idx_messages_created_at_direction" ON "public"."messages" USING "btree" ("created_at", "direction");



CREATE INDEX "idx_messages_dashboard_analytics" ON "public"."messages" USING "btree" ("conversation_id", "direction", "created_at" DESC) WHERE ("direction" = 'out'::"text");



CREATE INDEX "idx_messages_whatsapp_id" ON "public"."messages" USING "btree" ("whatsapp_message_id") WHERE ("whatsapp_message_id" IS NOT NULL);



COMMENT ON INDEX "public"."idx_messages_whatsapp_id" IS 'Optimizes WhatsApp status update lookups';



CREATE INDEX "idx_messages_whatsapp_message_id" ON "public"."messages" USING "btree" ("whatsapp_message_id");



CREATE INDEX "idx_meta_limits_user_id" ON "public"."meta_limits" USING "btree" ("user_id");



CREATE INDEX "idx_meta_limits_waba_id" ON "public"."meta_limits" USING "btree" ("waba_id");



CREATE INDEX "idx_notes_lead_history" ON "public"."notes" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "idx_notes_lead_id" ON "public"."notes" USING "btree" ("lead_id");



CREATE INDEX "idx_notes_user_id" ON "public"."notes" USING "btree" ("user_id");



CREATE INDEX "idx_pipeline_stages_order" ON "public"."pipeline_stages" USING "btree" ("pipeline_id", "display_order");



CREATE INDEX "idx_pipeline_stages_pipe_display" ON "public"."pipeline_stages" USING "btree" ("pipeline_id", "display_order");



CREATE INDEX "idx_pipeline_stages_pipeline_id" ON "public"."pipeline_stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_pipeline_stages_user_display" ON "public"."pipeline_stages" USING "btree" ("user_id", "display_order");



CREATE INDEX "idx_pipeline_stages_user_id" ON "public"."pipeline_stages" USING "btree" ("user_id");



CREATE INDEX "idx_pipeline_stages_user_pipeline" ON "public"."pipeline_stages" USING "btree" ("user_id", "pipeline_id");



CREATE INDEX "idx_pipelines_is_active" ON "public"."pipelines" USING "btree" ("is_active");



CREATE INDEX "idx_pipelines_user_created" ON "public"."pipelines" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_pipelines_user_default" ON "public"."pipelines" USING "btree" ("user_id", "is_default") WHERE ("is_default" = true);



CREATE INDEX "idx_pipelines_user_id" ON "public"."pipelines" USING "btree" ("user_id");



CREATE INDEX "idx_quick_replies_updated_at" ON "public"."quick_replies" USING "btree" ("updated_at" DESC);



CREATE INDEX "idx_quick_replies_user_id" ON "public"."quick_replies" USING "btree" ("user_id");



CREATE INDEX "idx_quick_replies_user_updated" ON "public"."quick_replies" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "idx_sheet_automations_flow_id" ON "public"."sheet_automations" USING "btree" ("flow_id") WHERE ("flow_id" IS NOT NULL);



CREATE INDEX "idx_sheet_automations_status_active" ON "public"."sheet_automations" USING "btree" ("status") WHERE ("status" = 'active'::"text");



CREATE INDEX "idx_sheet_automations_user_created" ON "public"."sheet_automations" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_sheet_automations_user_id" ON "public"."sheet_automations" USING "btree" ("user_id");



CREATE INDEX "idx_sheet_history_auto_hash" ON "public"."sheet_automation_history" USING "btree" ("automation_id", "row_hash");



CREATE INDEX "idx_sheet_history_lookup" ON "public"."sheet_automation_history" USING "btree" ("automation_id", "row_hash");



CREATE INDEX "idx_sheet_history_sent_at" ON "public"."sheet_automation_history" USING "btree" ("sent_at");



CREATE INDEX "idx_stages_pipeline_id" ON "public"."stages" USING "btree" ("pipeline_id");



CREATE INDEX "idx_stages_position" ON "public"."stages" USING "btree" ("position");



CREATE INDEX "idx_tags_name" ON "public"."tags" USING "btree" ("name");



CREATE INDEX "idx_tags_user_id" ON "public"."tags" USING "btree" ("user_id");



CREATE INDEX "idx_tasks_dashboard_summary" ON "public"."tasks" USING "btree" ("user_id", "is_completed", "due_date") WHERE ("is_completed" = false);



CREATE INDEX "idx_tasks_due_date" ON "public"."tasks" USING "btree" ("due_date");



CREATE INDEX "idx_tasks_due_lookup" ON "public"."tasks" USING "btree" ("is_completed", "due_date", "reminder_sent");



CREATE INDEX "idx_tasks_lead_id" ON "public"."tasks" USING "btree" ("lead_id");



CREATE INDEX "idx_tasks_pending_user" ON "public"."tasks" USING "btree" ("user_id") WHERE ("is_completed" = false);



CREATE INDEX "idx_tasks_performance" ON "public"."tasks" USING "btree" ("is_completed", "due_date", "id");



CREATE INDEX "idx_tasks_user_completed" ON "public"."tasks" USING "btree" ("user_id", "is_completed");



CREATE INDEX "idx_tasks_user_date" ON "public"."tasks" USING "btree" ("user_id", "due_date");



CREATE INDEX "idx_tasks_user_id" ON "public"."tasks" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_owner_id" ON "public"."team_members" USING "btree" ("owner_id");



CREATE INDEX "idx_team_members_owner_status" ON "public"."team_members" USING "btree" ("owner_id", "status");



CREATE INDEX "idx_team_members_user_id" ON "public"."team_members" USING "btree" ("user_id");



CREATE INDEX "idx_team_members_user_status" ON "public"."team_members" USING "btree" ("user_id", "status");



CREATE UNIQUE INDEX "idx_user_security_api_key" ON "public"."user_security" USING "btree" ("api_key") WHERE ("api_key" IS NOT NULL);



CREATE INDEX "idx_webhook_logs_capture" ON "public"."webhook_logs" USING "btree" ("webhook_id", "created_at" DESC);



CREATE INDEX "idx_webhook_logs_status" ON "public"."webhook_logs" USING "btree" ("processed_status", "created_at" DESC);



CREATE INDEX "idx_webhook_logs_user_recent" ON "public"."webhook_logs" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_webhook_logs_webhook_id" ON "public"."webhook_logs" USING "btree" ("webhook_id");



CREATE INDEX "idx_whatsapp_config_lookup" ON "public"."whatsapp_config" USING "btree" ("phone_number_id", "user_id");



CREATE UNIQUE INDEX "idx_whatsapp_config_phone_id_unique" ON "public"."whatsapp_config" USING "btree" ("phone_number_id");



CREATE INDEX "idx_whatsapp_config_user_id" ON "public"."whatsapp_config" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_flow_submissions_flow_id" ON "public"."whatsapp_flow_submissions" USING "btree" ("flow_id");



CREATE INDEX "idx_whatsapp_flow_submissions_user_id" ON "public"."whatsapp_flow_submissions" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_templates_lookup" ON "public"."whatsapp_templates" USING "btree" ("user_id", "name");



CREATE INDEX "idx_whatsapp_templates_name_lang" ON "public"."whatsapp_templates" USING "btree" ("name", "language");



CREATE INDEX "idx_whatsapp_templates_sync_lookup" ON "public"."whatsapp_templates" USING "btree" ("user_id", "name", "language");



CREATE INDEX "idx_whatsapp_templates_user_id" ON "public"."whatsapp_templates" USING "btree" ("user_id");



CREATE INDEX "idx_whatsapp_templates_user_status" ON "public"."whatsapp_templates" USING "btree" ("user_id", "status");



CREATE INDEX "idx_whatsapp_templates_user_updated" ON "public"."whatsapp_templates" USING "btree" ("user_id", "updated_at" DESC);



CREATE INDEX "ix_realtime_subscription_entity" ON "realtime"."subscription" USING "btree" ("entity");



CREATE INDEX "messages_inserted_at_topic_index" ON ONLY "realtime"."messages" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_07_inserted_at_topic_idx" ON "realtime"."messages_2026_05_07" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_08_inserted_at_topic_idx" ON "realtime"."messages_2026_05_08" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_09_inserted_at_topic_idx" ON "realtime"."messages_2026_05_09" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_10_inserted_at_topic_idx" ON "realtime"."messages_2026_05_10" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_11_inserted_at_topic_idx" ON "realtime"."messages_2026_05_11" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_12_inserted_at_topic_idx" ON "realtime"."messages_2026_05_12" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE INDEX "messages_2026_05_13_inserted_at_topic_idx" ON "realtime"."messages_2026_05_13" USING "btree" ("inserted_at" DESC, "topic") WHERE (("extension" = 'broadcast'::"text") AND ("private" IS TRUE));



CREATE UNIQUE INDEX "subscription_subscription_id_entity_filters_action_filter_key" ON "realtime"."subscription" USING "btree" ("subscription_id", "entity", "filters", "action_filter");



CREATE UNIQUE INDEX "bname" ON "storage"."buckets" USING "btree" ("name");



CREATE UNIQUE INDEX "bucketid_objname" ON "storage"."objects" USING "btree" ("bucket_id", "name");



CREATE UNIQUE INDEX "buckets_analytics_unique_name_idx" ON "storage"."buckets_analytics" USING "btree" ("name") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_multipart_uploads_list" ON "storage"."s3_multipart_uploads" USING "btree" ("bucket_id", "key", "created_at");



CREATE INDEX "idx_objects_bucket_id_name" ON "storage"."objects" USING "btree" ("bucket_id", "name" COLLATE "C");



CREATE INDEX "idx_objects_bucket_id_name_lower" ON "storage"."objects" USING "btree" ("bucket_id", "lower"("name") COLLATE "C");



CREATE INDEX "name_prefix_search" ON "storage"."objects" USING "btree" ("name" "text_pattern_ops");



CREATE UNIQUE INDEX "vector_indexes_name_bucket_id_idx" ON "storage"."vector_indexes" USING "btree" ("name", "bucket_id");



CREATE INDEX "supabase_functions_hooks_h_table_id_h_name_idx" ON "supabase_functions"."hooks" USING "btree" ("hook_table_id", "hook_name");



CREATE INDEX "supabase_functions_hooks_request_id_idx" ON "supabase_functions"."hooks" USING "btree" ("request_id");



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_07_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_07_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_08_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_08_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_09_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_09_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_10_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_10_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_11_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_11_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_12_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_12_pkey";



ALTER INDEX "realtime"."messages_inserted_at_topic_index" ATTACH PARTITION "realtime"."messages_2026_05_13_inserted_at_topic_idx";



ALTER INDEX "realtime"."messages_pkey" ATTACH PARTITION "realtime"."messages_2026_05_13_pkey";



CREATE OR REPLACE TRIGGER "on_auth_user_created" AFTER INSERT ON "auth"."users" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_user"();



CREATE OR REPLACE TRIGGER "check_limit_before_profile_insert" BEFORE INSERT ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."check_tenant_limit"();



CREATE OR REPLACE TRIGGER "trg_update_flow_keywords" BEFORE INSERT OR UPDATE ON "public"."flows" FOR EACH ROW EXECUTE FUNCTION "public"."update_flow_keywords"();



CREATE OR REPLACE TRIGGER "update_appointments_updated_at" BEFORE UPDATE ON "public"."appointments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_drip_campaigns_updated_at" BEFORE UPDATE ON "public"."drip_campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_forms_updated_at" BEFORE UPDATE ON "public"."forms" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_notes_updated_at" BEFORE UPDATE ON "public"."notes" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_pipelines_updated_at" BEFORE UPDATE ON "public"."pipelines" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_stages_updated_at" BEFORE UPDATE ON "public"."stages" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_tasks_updated_at" BEFORE UPDATE ON "public"."tasks" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "tr_check_filters" BEFORE INSERT OR UPDATE ON "realtime"."subscription" FOR EACH ROW EXECUTE FUNCTION "realtime"."subscription_check_filters"();



CREATE OR REPLACE TRIGGER "enforce_bucket_name_length_trigger" BEFORE INSERT OR UPDATE OF "name" ON "storage"."buckets" FOR EACH ROW EXECUTE FUNCTION "storage"."enforce_bucket_name_length"();



CREATE OR REPLACE TRIGGER "protect_buckets_delete" BEFORE DELETE ON "storage"."buckets" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "protect_objects_delete" BEFORE DELETE ON "storage"."objects" FOR EACH STATEMENT EXECUTE FUNCTION "storage"."protect_delete"();



CREATE OR REPLACE TRIGGER "update_objects_updated_at" BEFORE UPDATE ON "storage"."objects" FOR EACH ROW EXECUTE FUNCTION "storage"."update_updated_at_column"();



ALTER TABLE ONLY "auth"."identities"
    ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_amr_claims"
    ADD CONSTRAINT "mfa_amr_claims_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_challenges"
    ADD CONSTRAINT "mfa_challenges_auth_factor_id_fkey" FOREIGN KEY ("factor_id") REFERENCES "auth"."mfa_factors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."mfa_factors"
    ADD CONSTRAINT "mfa_factors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_authorizations"
    ADD CONSTRAINT "oauth_authorizations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."oauth_consents"
    ADD CONSTRAINT "oauth_consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."one_time_tokens"
    ADD CONSTRAINT "one_time_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "auth"."sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_providers"
    ADD CONSTRAINT "saml_providers_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_flow_state_id_fkey" FOREIGN KEY ("flow_state_id") REFERENCES "auth"."flow_state"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."saml_relay_states"
    ADD CONSTRAINT "saml_relay_states_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_oauth_client_id_fkey" FOREIGN KEY ("oauth_client_id") REFERENCES "auth"."oauth_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sessions"
    ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."sso_domains"
    ADD CONSTRAINT "sso_domains_sso_provider_id_fkey" FOREIGN KEY ("sso_provider_id") REFERENCES "auth"."sso_providers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_challenges"
    ADD CONSTRAINT "webauthn_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "auth"."webauthn_credentials"
    ADD CONSTRAINT "webauthn_credentials_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."drip_campaigns"
    ADD CONSTRAINT "drip_campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."drip_enrollments"
    ADD CONSTRAINT "drip_enrollments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drip_enrollments"
    ADD CONSTRAINT "drip_enrollments_current_step_id_fkey" FOREIGN KEY ("current_step_id") REFERENCES "public"."drip_steps"("id");



ALTER TABLE ONLY "public"."drip_enrollments"
    ADD CONSTRAINT "drip_enrollments_drip_campaign_id_fkey" FOREIGN KEY ("drip_campaign_id") REFERENCES "public"."drip_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."drip_logs"
    ADD CONSTRAINT "drip_logs_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drip_logs"
    ADD CONSTRAINT "drip_logs_drip_enrollment_id_fkey" FOREIGN KEY ("drip_enrollment_id") REFERENCES "public"."drip_enrollments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."drip_steps"
    ADD CONSTRAINT "drip_steps_drip_campaign_id_fkey" FOREIGN KEY ("drip_campaign_id") REFERENCES "public"."drip_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flow_sessions"
    ADD CONSTRAINT "flow_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."flows"
    ADD CONSTRAINT "flows_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."follow_ups"
    ADD CONSTRAINT "follow_ups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."followup_campaigns"
    ADD CONSTRAINT "followup_campaigns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_enrollments"
    ADD CONSTRAINT "followup_enrollments_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."followup_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_enrollments"
    ADD CONSTRAINT "followup_enrollments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_enrollments"
    ADD CONSTRAINT "followup_enrollments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_logs"
    ADD CONSTRAINT "followup_logs_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "public"."followup_enrollments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_logs"
    ADD CONSTRAINT "followup_logs_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "public"."followup_steps"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."followup_steps"
    ADD CONSTRAINT "followup_steps_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."followup_campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."followup_steps"
    ADD CONSTRAINT "followup_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."whatsapp_templates"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."quick_replies"
    ADD CONSTRAINT "quick_replies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sheet_automation_history"
    ADD CONSTRAINT "sheet_automation_history_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."sheet_automations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sheet_automation_logs"
    ADD CONSTRAINT "sheet_automation_logs_automation_id_fkey" FOREIGN KEY ("automation_id") REFERENCES "public"."sheet_automations"("id");



ALTER TABLE ONLY "public"."sheet_automations"
    ADD CONSTRAINT "sheet_automations_flow_id_fkey" FOREIGN KEY ("flow_id") REFERENCES "public"."flows"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "storage"."objects"
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads"
    ADD CONSTRAINT "s3_multipart_uploads_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets"("id");



ALTER TABLE ONLY "storage"."s3_multipart_uploads_parts"
    ADD CONSTRAINT "s3_multipart_uploads_parts_upload_id_fkey" FOREIGN KEY ("upload_id") REFERENCES "storage"."s3_multipart_uploads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "storage"."vector_indexes"
    ADD CONSTRAINT "vector_indexes_bucket_id_fkey" FOREIGN KEY ("bucket_id") REFERENCES "storage"."buckets_vectors"("id");



ALTER TABLE "auth"."audit_log_entries" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."flow_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."identities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."instances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_amr_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_challenges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."mfa_factors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."one_time_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."refresh_tokens" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."saml_relay_states" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."schema_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."sso_providers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "auth"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Agents can view own record" ON "public"."team_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Agents can view self" ON "public"."team_members" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Allow public read of limits" ON "public"."tenant_limits" FOR SELECT USING (true);



CREATE POLICY "Allow public read of plans" ON "public"."tenant_plans" FOR SELECT USING (true);



CREATE POLICY "Allow public read of settings" ON "public"."domain_settings" FOR SELECT USING (true);



CREATE POLICY "Allow read access to authenticated users" ON "public"."plans" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "Anyone can submit forms" ON "public"."form_submissions" FOR INSERT TO "authenticated", "anon", "service_role" WITH CHECK (("length"(("submission_data")::"text") > 2));



CREATE POLICY "Anyone can view forms by token" ON "public"."forms" FOR SELECT USING (true);



CREATE POLICY "Owners can delete team" ON "public"."team_members" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can insert team" ON "public"."team_members" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can manage team" ON "public"."team_members" USING (("auth"."uid"() = "owner_id")) WITH CHECK (("auth"."uid"() = "owner_id"));



CREATE POLICY "Owners can update team" ON "public"."team_members" FOR UPDATE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Owners can view team" ON "public"."team_members" FOR SELECT USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Public view active forms" ON "public"."forms" FOR SELECT TO "anon" USING (("is_active" = true));



CREATE POLICY "Service role full access" ON "public"."domain_settings" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service role full access" ON "public"."profiles" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "System can insert submissions" ON "public"."whatsapp_flow_submissions" FOR INSERT TO "service_role" WITH CHECK (true);



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



CREATE POLICY "Users can delete their own quick replies" ON "public"."quick_replies" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own sheet automations" ON "public"."sheet_automations" FOR DELETE USING (("auth"."uid"() = "user_id"));



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



CREATE POLICY "Users can insert their own quick replies" ON "public"."quick_replies" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own security settings" ON "public"."user_security" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own sheet automations" ON "public"."sheet_automations" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own stages" ON "public"."pipeline_stages" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tags" ON "public"."tags" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own tasks" ON "public"."tasks" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own templates" ON "public"."whatsapp_templates" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert their own whatsapp config" ON "public"."whatsapp_config" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage own pipeline_stages" ON "public"."pipeline_stages" USING ((EXISTS ( SELECT 1
   FROM "public"."pipelines"
  WHERE (("pipelines"."id" = "pipeline_stages"."pipeline_id") AND ("pipelines"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own enrollments" ON "public"."followup_enrollments" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own followup campaigns" ON "public"."followup_campaigns" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can manage their own followup steps" ON "public"."followup_steps" USING ((EXISTS ( SELECT 1
   FROM "public"."followup_campaigns" "c"
  WHERE (("c"."id" = "followup_steps"."campaign_id") AND ("c"."user_id" = "auth"."uid"())))));



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



CREATE POLICY "Users can update their own quick replies" ON "public"."quick_replies" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own security data" ON "public"."user_security" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own security settings" ON "public"."user_security" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own sheet automations" ON "public"."sheet_automations" FOR UPDATE USING (("auth"."uid"() = "user_id"));



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



CREATE POLICY "Users can view history of their automations" ON "public"."sheet_automation_history" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."sheet_automations" "a"
  WHERE (("a"."id" = "sheet_automation_history"."automation_id") AND ("a"."user_id" = "auth"."uid"())))));



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



CREATE POLICY "Users can view their own enrollments" ON "public"."followup_enrollments" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own fields" ON "public"."custom_fields" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own flow sessions" ON "public"."flow_sessions" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own flows" ON "public"."flows" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own followup campaigns" ON "public"."followup_campaigns" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own followup steps" ON "public"."followup_steps" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."followup_campaigns" "c"
  WHERE (("c"."id" = "followup_steps"."campaign_id") AND ("c"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own forms" ON "public"."forms" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own groups" ON "public"."contact_groups" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own integrations" ON "public"."user_integrations" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own leads" ON "public"."leads" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own limits" ON "public"."meta_limits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own logs" ON "public"."followup_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."followup_enrollments" "e"
  WHERE (("e"."id" = "followup_logs"."enrollment_id") AND ("e"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their own notes" ON "public"."notes" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own onboarding settings" ON "public"."onboarding_settings" FOR SELECT USING ((("auth"."uid"())::"text" = "user_id"));



CREATE POLICY "Users can view their own pages" ON "public"."integration_facebook_pages" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own pipelines" ON "public"."pipelines" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own quick replies" ON "public"."quick_replies" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own security data" ON "public"."user_security" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own security settings" ON "public"."user_security" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own sheet automations" ON "public"."sheet_automations" FOR SELECT USING (("auth"."uid"() = "user_id"));



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


ALTER TABLE "public"."campaign_rate_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_worker_claims" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."custom_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."domain_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drip_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drip_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drip_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."drip_steps" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flow_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."flows" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."follow_ups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_enrollments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."followup_steps" ENABLE ROW LEVEL SECURITY;


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


ALTER TABLE "public"."quick_replies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sheet_automation_history" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sheet_automation_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."sheet_automations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."template_components_cache" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_limits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_plans" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_integrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_security" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_subscriptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."webhook_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_config" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_flow_submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "realtime"."messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_analytics" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."buckets_vectors" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."objects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."s3_multipart_uploads_parts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "storage"."vector_indexes" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "auth" TO "anon";
GRANT USAGE ON SCHEMA "auth" TO "authenticated";
GRANT USAGE ON SCHEMA "auth" TO "service_role";
GRANT ALL ON SCHEMA "auth" TO "supabase_auth_admin";
GRANT ALL ON SCHEMA "auth" TO "dashboard_user";
GRANT USAGE ON SCHEMA "auth" TO "postgres";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT USAGE ON SCHEMA "realtime" TO "postgres";
GRANT USAGE ON SCHEMA "realtime" TO "anon";
GRANT USAGE ON SCHEMA "realtime" TO "authenticated";
GRANT USAGE ON SCHEMA "realtime" TO "service_role";
GRANT ALL ON SCHEMA "realtime" TO "supabase_realtime_admin";



GRANT USAGE ON SCHEMA "storage" TO "postgres" WITH GRANT OPTION;
GRANT USAGE ON SCHEMA "storage" TO "anon";
GRANT USAGE ON SCHEMA "storage" TO "authenticated";
GRANT USAGE ON SCHEMA "storage" TO "service_role";
GRANT ALL ON SCHEMA "storage" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON SCHEMA "storage" TO "dashboard_user";



GRANT USAGE ON SCHEMA "supabase_functions" TO "postgres";
GRANT USAGE ON SCHEMA "supabase_functions" TO "anon";
GRANT USAGE ON SCHEMA "supabase_functions" TO "authenticated";
GRANT USAGE ON SCHEMA "supabase_functions" TO "service_role";
GRANT ALL ON SCHEMA "supabase_functions" TO "supabase_functions_admin";



GRANT ALL ON FUNCTION "auth"."email"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."jwt"() TO "postgres";
GRANT ALL ON FUNCTION "auth"."jwt"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."role"() TO "dashboard_user";



GRANT ALL ON FUNCTION "auth"."uid"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."add_new_tenant"("new_domain" "text", "initial_limit" integer, "plan_name" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_admin_status"("check_domain" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_admin_status"("check_domain" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_tenant_limit"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_tenant_plan_notification"("check_domain" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."check_user_plan_status"("target_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."delete_tenant"("target_domain" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_tenant"("target_domain" "text") TO "service_role";



GRANT ALL ON TABLE "public"."drip_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."drip_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."drip_enrollments" TO "service_role";



GRANT ALL ON FUNCTION "public"."fetch_and_lock_drip_jobs"("batch_size" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fetch_and_lock_drip_jobs"("batch_size" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fetch_and_lock_drip_jobs"("batch_size" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "anon";
GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_form_token"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_owner_id"() TO "service_role";



GRANT ALL ON TABLE "public"."flow_sessions" TO "anon";
GRANT ALL ON TABLE "public"."flow_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."flow_sessions" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_active_session"("p_contact_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_all_tenants_summary"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_all_tenants_summary"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_dashboard_stats"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") TO "service_role";



GRANT ALL ON TABLE "public"."flows" TO "anon";
GRANT ALL ON TABLE "public"."flows" TO "authenticated";
GRANT ALL ON TABLE "public"."flows" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_lead_dashboard_stats_v2"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_lead_dashboard_stats_v2"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_lead_dashboard_stats_v2"("p_user_id" "uuid") TO "service_role";



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



REVOKE ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "service_role";
GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) TO "authenticated";



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



REVOKE ALL ON FUNCTION "public"."lock_session_for_processing"("p_session_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lock_session_for_processing"("p_session_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_lead_stage_change"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_lead_stage_change"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."log_webhook_event"("p_user_id" "uuid", "p_phone_number_id" "text", "p_http_method" "text", "p_raw_payload" "jsonb", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_webhook_id" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."search_leads"("p_org_id" "uuid", "p_search_text" "text", "p_pipeline_id" "uuid", "p_stage_id" "uuid", "p_owner_id" "uuid", "p_tags" "text"[], "p_status" "text", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."submit_form"("p_form_token" "text", "p_submission_data" "jsonb", "p_ip_address" "text", "p_user_agent" "text") TO "authenticated";



GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_flow_keywords"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_message_status"("p_whatsapp_message_id" "text", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_status"("p_session_id" "uuid", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_tenant_limit"("target_domain" "text", "new_limit" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_webhook_log"("p_log_id" "uuid", "p_processed_status" "text", "p_message_type" "text", "p_sender_phone" "text", "p_extracted_content" "jsonb", "p_error_message" "text") TO "authenticated";



GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "anon";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."apply_rls"("wal" "jsonb", "max_record_bytes" integer) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."broadcast_changes"("topic_name" "text", "event_name" "text", "operation" "text", "table_name" "text", "table_schema" "text", "new" "record", "old" "record", "level" "text") TO "dashboard_user";



GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "anon";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."build_prepared_statement_sql"("prepared_statement_name" "text", "entity" "regclass", "columns" "realtime"."wal_column"[]) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "anon";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."cast"("val" "text", "type_" "regtype") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "anon";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."check_equality_op"("op" "realtime"."equality_op", "type_" "regtype", "val_1" "text", "val_2" "text") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "anon";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "service_role";
GRANT ALL ON FUNCTION "realtime"."is_visible_through_filters"("columns" "realtime"."wal_column"[], "filters" "realtime"."user_defined_filter"[]) TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."list_changes"("publication" "name", "slot_name" "name", "max_changes" integer, "max_record_bytes" integer) TO "dashboard_user";



GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "anon";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."quote_wal2json"("entity" "regclass") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) TO "postgres";
GRANT ALL ON FUNCTION "realtime"."send"("payload" "jsonb", "event" "text", "topic" "text", "private" boolean) TO "dashboard_user";



GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "postgres";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "anon";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "service_role";
GRANT ALL ON FUNCTION "realtime"."subscription_check_filters"() TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "postgres";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "dashboard_user";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "anon";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "service_role";
GRANT ALL ON FUNCTION "realtime"."to_regrole"("role_name" "text") TO "supabase_realtime_admin";



GRANT ALL ON FUNCTION "realtime"."topic"() TO "postgres";
GRANT ALL ON FUNCTION "realtime"."topic"() TO "dashboard_user";



REVOKE ALL ON FUNCTION "supabase_functions"."http_request"() FROM PUBLIC;
GRANT ALL ON FUNCTION "supabase_functions"."http_request"() TO "postgres";
GRANT ALL ON FUNCTION "supabase_functions"."http_request"() TO "anon";
GRANT ALL ON FUNCTION "supabase_functions"."http_request"() TO "authenticated";
GRANT ALL ON FUNCTION "supabase_functions"."http_request"() TO "service_role";



GRANT ALL ON TABLE "auth"."audit_log_entries" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."audit_log_entries" TO "postgres";
GRANT SELECT ON TABLE "auth"."audit_log_entries" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "postgres";
GRANT ALL ON TABLE "auth"."custom_oauth_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."flow_state" TO "postgres";
GRANT SELECT ON TABLE "auth"."flow_state" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."flow_state" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."identities" TO "postgres";
GRANT SELECT ON TABLE "auth"."identities" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."identities" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."instances" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."instances" TO "postgres";
GRANT SELECT ON TABLE "auth"."instances" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_amr_claims" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_amr_claims" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_amr_claims" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_challenges" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_challenges" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_challenges" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."mfa_factors" TO "postgres";
GRANT SELECT ON TABLE "auth"."mfa_factors" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."mfa_factors" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_authorizations" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_client_states" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_client_states" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_clients" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_clients" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."oauth_consents" TO "postgres";
GRANT ALL ON TABLE "auth"."oauth_consents" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."one_time_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."one_time_tokens" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."one_time_tokens" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."refresh_tokens" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."refresh_tokens" TO "postgres";
GRANT SELECT ON TABLE "auth"."refresh_tokens" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "dashboard_user";
GRANT ALL ON SEQUENCE "auth"."refresh_tokens_id_seq" TO "postgres";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_providers" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."saml_relay_states" TO "postgres";
GRANT SELECT ON TABLE "auth"."saml_relay_states" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."saml_relay_states" TO "dashboard_user";



GRANT SELECT ON TABLE "auth"."schema_migrations" TO "postgres" WITH GRANT OPTION;



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sessions" TO "postgres";
GRANT SELECT ON TABLE "auth"."sessions" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sessions" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_domains" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_domains" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_domains" TO "dashboard_user";



GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."sso_providers" TO "postgres";
GRANT SELECT ON TABLE "auth"."sso_providers" TO "postgres" WITH GRANT OPTION;
GRANT ALL ON TABLE "auth"."sso_providers" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."users" TO "dashboard_user";
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "auth"."users" TO "postgres";
GRANT SELECT ON TABLE "auth"."users" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_challenges" TO "dashboard_user";



GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "postgres";
GRANT ALL ON TABLE "auth"."webauthn_credentials" TO "dashboard_user";



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



GRANT ALL ON TABLE "public"."campaign_rate_limits" TO "anon";
GRANT ALL ON TABLE "public"."campaign_rate_limits" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_rate_limits" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_worker_claims" TO "anon";
GRANT ALL ON TABLE "public"."campaign_worker_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_worker_claims" TO "service_role";



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



GRANT ALL ON TABLE "public"."drip_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."drip_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."drip_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."drip_logs" TO "anon";
GRANT ALL ON TABLE "public"."drip_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."drip_logs" TO "service_role";



GRANT ALL ON TABLE "public"."drip_steps" TO "anon";
GRANT ALL ON TABLE "public"."drip_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."drip_steps" TO "service_role";



GRANT ALL ON TABLE "public"."follow_ups" TO "anon";
GRANT ALL ON TABLE "public"."follow_ups" TO "authenticated";
GRANT ALL ON TABLE "public"."follow_ups" TO "service_role";



GRANT ALL ON TABLE "public"."followup_campaigns" TO "anon";
GRANT ALL ON TABLE "public"."followup_campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."followup_enrollments" TO "anon";
GRANT ALL ON TABLE "public"."followup_enrollments" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_enrollments" TO "service_role";



GRANT ALL ON TABLE "public"."followup_logs" TO "anon";
GRANT ALL ON TABLE "public"."followup_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_logs" TO "service_role";



GRANT ALL ON TABLE "public"."followup_steps" TO "anon";
GRANT ALL ON TABLE "public"."followup_steps" TO "authenticated";
GRANT ALL ON TABLE "public"."followup_steps" TO "service_role";



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



GRANT ALL ON TABLE "public"."quick_replies" TO "anon";
GRANT ALL ON TABLE "public"."quick_replies" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_replies" TO "service_role";



GRANT ALL ON TABLE "public"."sheet_automation_history" TO "anon";
GRANT ALL ON TABLE "public"."sheet_automation_history" TO "authenticated";
GRANT ALL ON TABLE "public"."sheet_automation_history" TO "service_role";



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



GRANT ALL ON TABLE "public"."template_components_cache" TO "anon";
GRANT ALL ON TABLE "public"."template_components_cache" TO "authenticated";
GRANT ALL ON TABLE "public"."template_components_cache" TO "service_role";



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



GRANT ALL ON TABLE "realtime"."messages" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages" TO "dashboard_user";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "anon";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "authenticated";
GRANT SELECT,INSERT,UPDATE ON TABLE "realtime"."messages" TO "service_role";



GRANT ALL ON TABLE "realtime"."messages_2026_05_07" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_07" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_08" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_08" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_09" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_09" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_10" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_10" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_11" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_11" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_12" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_12" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."messages_2026_05_13" TO "postgres";
GRANT ALL ON TABLE "realtime"."messages_2026_05_13" TO "dashboard_user";



GRANT ALL ON TABLE "realtime"."schema_migrations" TO "postgres";
GRANT ALL ON TABLE "realtime"."schema_migrations" TO "dashboard_user";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "anon";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "authenticated";
GRANT SELECT ON TABLE "realtime"."schema_migrations" TO "service_role";
GRANT ALL ON TABLE "realtime"."schema_migrations" TO "supabase_realtime_admin";



GRANT ALL ON TABLE "realtime"."subscription" TO "postgres";
GRANT ALL ON TABLE "realtime"."subscription" TO "dashboard_user";
GRANT SELECT ON TABLE "realtime"."subscription" TO "anon";
GRANT SELECT ON TABLE "realtime"."subscription" TO "authenticated";
GRANT SELECT ON TABLE "realtime"."subscription" TO "service_role";
GRANT ALL ON TABLE "realtime"."subscription" TO "supabase_realtime_admin";



GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "postgres";
GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "dashboard_user";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "anon";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "authenticated";
GRANT USAGE ON SEQUENCE "realtime"."subscription_id_seq" TO "service_role";
GRANT ALL ON SEQUENCE "realtime"."subscription_id_seq" TO "supabase_realtime_admin";



REVOKE ALL ON TABLE "storage"."buckets" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."buckets" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."buckets" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets" TO "anon";
GRANT ALL ON TABLE "storage"."buckets" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."buckets_analytics" TO "service_role";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "authenticated";
GRANT ALL ON TABLE "storage"."buckets_analytics" TO "anon";



GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "service_role";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "authenticated";
GRANT SELECT ON TABLE "storage"."buckets_vectors" TO "anon";



REVOKE ALL ON TABLE "storage"."objects" FROM "supabase_storage_admin";
GRANT ALL ON TABLE "storage"."objects" TO "supabase_storage_admin" WITH GRANT OPTION;
GRANT ALL ON TABLE "storage"."objects" TO "service_role";
GRANT ALL ON TABLE "storage"."objects" TO "authenticated";
GRANT ALL ON TABLE "storage"."objects" TO "anon";
GRANT ALL ON TABLE "storage"."objects" TO "postgres" WITH GRANT OPTION;



GRANT ALL ON TABLE "storage"."s3_multipart_uploads" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads" TO "anon";



GRANT ALL ON TABLE "storage"."s3_multipart_uploads_parts" TO "service_role";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "authenticated";
GRANT SELECT ON TABLE "storage"."s3_multipart_uploads_parts" TO "anon";



GRANT SELECT ON TABLE "storage"."vector_indexes" TO "service_role";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "authenticated";
GRANT SELECT ON TABLE "storage"."vector_indexes" TO "anon";



GRANT ALL ON TABLE "supabase_functions"."hooks" TO "postgres";
GRANT ALL ON TABLE "supabase_functions"."hooks" TO "anon";
GRANT ALL ON TABLE "supabase_functions"."hooks" TO "authenticated";
GRANT ALL ON TABLE "supabase_functions"."hooks" TO "service_role";



GRANT ALL ON SEQUENCE "supabase_functions"."hooks_id_seq" TO "postgres";
GRANT ALL ON SEQUENCE "supabase_functions"."hooks_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "supabase_functions"."hooks_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "supabase_functions"."hooks_id_seq" TO "service_role";



GRANT ALL ON TABLE "supabase_functions"."migrations" TO "postgres";
GRANT ALL ON TABLE "supabase_functions"."migrations" TO "anon";
GRANT ALL ON TABLE "supabase_functions"."migrations" TO "authenticated";
GRANT ALL ON TABLE "supabase_functions"."migrations" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON SEQUENCES TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON FUNCTIONS TO "dashboard_user";



ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "supabase_auth_admin" IN SCHEMA "auth" GRANT ALL ON TABLES TO "dashboard_user";



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















ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON SEQUENCES TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON FUNCTIONS TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "storage" GRANT ALL ON TABLES TO "service_role";


-- =================================================================
-- Team Staff Management Module Migration
-- Created: 2026-05-11
-- =================================================================

-- 1. team_staff table
CREATE TABLE IF NOT EXISTS "public"."team_staff" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "created_by" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE,
    "phone" text,
    "password_hash" text NOT NULL,
    "role" text DEFAULT 'staff',
    "status" text DEFAULT 'active',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- 2. team_staff_permissions table
CREATE TABLE IF NOT EXISTS "public"."team_staff_permissions" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "staff_id" uuid NOT NULL REFERENCES public.team_staff(id) ON DELETE CASCADE,
    "module_name" text NOT NULL,
    "access_type" text NOT NULL CHECK (access_type IN ('read', 'read_write', 'no_access', 'all_access')),
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    UNIQUE(staff_id, module_name)
);

-- 3. lead_assignments table
CREATE TABLE IF NOT EXISTS "public"."lead_assignments" (
    "id" uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    "tenant_id" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "lead_id" uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    "assigned_to" uuid NOT NULL REFERENCES public.team_staff(id) ON DELETE CASCADE,
    "assigned_by" uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now(),
    UNIQUE(lead_id, assigned_to)
);

-- Indexes for performance and multi-tenancy
CREATE INDEX IF NOT EXISTS idx_team_staff_tenant ON "public"."team_staff" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_team_staff_email ON "public"."team_staff" ("email");
CREATE INDEX IF NOT EXISTS idx_staff_permissions_staff ON "public"."team_staff_permissions" ("staff_id");
CREATE INDEX IF NOT EXISTS idx_staff_permissions_tenant ON "public"."team_staff_permissions" ("tenant_id");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_lead ON "public"."lead_assignments" ("lead_id");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_staff ON "public"."lead_assignments" ("assigned_to");
CREATE INDEX IF NOT EXISTS idx_lead_assignments_tenant ON "public"."lead_assignments" ("tenant_id");

-- RLS (Row Level Security)
ALTER TABLE "public"."team_staff" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."team_staff_permissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lead_assignments" ENABLE ROW LEVEL SECURITY;

-- Basic Policies (Owner can manage their own staff)
DROP POLICY IF EXISTS "Owners can manage their staff" ON "public"."team_staff";
CREATE POLICY "Owners can manage their staff" ON "public"."team_staff"
    FOR ALL USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Owners can manage staff permissions" ON "public"."team_staff_permissions";
CREATE POLICY "Owners can manage staff permissions" ON "public"."team_staff_permissions"
    FOR ALL USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Owners can manage lead assignments" ON "public"."lead_assignments";
CREATE POLICY "Owners can manage lead assignments" ON "public"."lead_assignments"
    FOR ALL USING (auth.uid() = tenant_id);

-- Staff can view their own record and permissions
-- Note: Simplified to directly check email to avoid RLS infinite recursion
DROP POLICY IF EXISTS "Staff can view their own profile" ON "public"."team_staff";
CREATE POLICY "Staff can view their own profile" ON "public"."team_staff"
    FOR SELECT USING (email = auth.email());

DROP POLICY IF EXISTS "Staff can view their own permissions" ON "public"."team_staff_permissions";
CREATE POLICY "Staff can view their own permissions" ON "public"."team_staff_permissions"
    FOR SELECT USING (staff_id = (SELECT id FROM public.team_staff WHERE email = auth.email() LIMIT 1));


-- Ensure assigned_staff_ids column exists on leads table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_staff_ids') THEN
        ALTER TABLE leads ADD COLUMN assigned_staff_ids UUID[] DEFAULT '{}';
    END IF;
END $$;

-- GIN index for fast array containment search on assigned staff
CREATE INDEX IF NOT EXISTS idx_leads_assigned_staff_ids ON "public"."leads" USING gin ("assigned_staff_ids");

