-- Run this script in your Supabase SQL Editor to significantly reduce Dashboard egress and latency.
-- This function calculates all dashboard lead metrics directly inside the database, 
-- avoiding the need to transfer up to 10,000 rows over the network to the Node.js server.

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_user_id UUID)
RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
