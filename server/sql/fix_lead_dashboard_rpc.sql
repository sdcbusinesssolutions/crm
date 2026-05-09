-- 1. Drop existing function to avoid signature conflicts
DROP FUNCTION IF EXISTS get_lead_dashboard_stats_v2(uuid);

-- 2. Create the fixed, robust, and PERFORMANCE-OPTIMIZED version
CREATE OR REPLACE FUNCTION get_lead_dashboard_stats_v2(p_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
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
$$ LANGUAGE plpgsql;
