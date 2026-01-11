-- =====================================================================================
-- SCHEMA INTEGRITY CHECK SCRIPT
-- Run this in the Supabase SQL Editor of any project to validate it against the master schema.
-- =====================================================================================

WITH expected_tables(table_name) AS (
    VALUES 
        ('appointments'),
        ('branding_settings'),
        ('call_logs'),
        ('campaign_queue'),
        ('campaigns'),
        ('contact_groups'),
        ('contacts'),
        ('conversations'),
        ('custom_fields'),
        ('flow_sessions'),
        ('flows'),
        ('form_submissions'),
        ('forms'),
        ('integration_facebook_pages'),
        ('leads'),
        ('messages'),
        ('meta_limits'),
        ('notes'),
        ('onboarding_settings'),
        ('pipeline_stages'),
        ('pipelines'),
        ('plans'),
        ('stages'),
        ('tags'),
        ('tasks'),
        ('team_members'),
        ('user_integrations'),
        ('user_security'),
        ('user_subscriptions'),
        ('webhook_logs'),
        ('whatsapp_config'),
        ('whatsapp_flow_submissions'),
        ('whatsapp_templates'),
        -- Also checking for the newly added campaign_media
        ('campaign_media')
),
actual_tables AS (
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
),
missing_tables AS (
    SELECT e.table_name 
    FROM expected_tables e
    LEFT JOIN actual_tables a ON e.table_name = a.table_name
    WHERE a.table_name IS NULL
),
rls_check AS (
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename IN (SELECT table_name FROM expected_tables)
),
policy_counts AS (
    SELECT tablename, count(*) as policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
)

SELECT 
    'SUMMARY' as check_type,
    (SELECT COUNT(*)::text FROM expected_tables) || ' Expected Tables' as details,
    (SELECT COUNT(*)::text FROM actual_tables WHERE table_name IN (SELECT table_name FROM expected_tables)) || ' Found' as status

UNION ALL

SELECT 
    'MISSING TABLE' as check_type,
    table_name as details,
    'CRITICAL: Table missing' as status
FROM missing_tables

UNION ALL

SELECT
    'RLS CHECK' as check_type,
    tablename as details,
    CASE WHEN rowsecurity = true THEN 'OK' ELSE 'WARNING: RLS Disabled' END as status
FROM rls_check
WHERE rowsecurity = false

UNION ALL

SELECT 
    'POLICY COUNT' as check_type,
    tablename as details,
    policy_count || ' policies found' as status
FROM policy_counts;

