-- =====================================================================
-- FUNCTION: get_schema_deep_info
-- PURPOSE: Returns detailed schema info (Tables, Columns, Policies, Triggers, Functions)
--          as a single JSON object for deployment validation.
-- =====================================================================

CREATE OR REPLACE FUNCTION get_schema_deep_info()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as owner (postgres) to see full metadata
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
