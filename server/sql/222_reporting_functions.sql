-- ====================================================================================
-- 222_reporting_functions.sql
-- Financial & Usage Reporting Aggregations (Section 6.2)
-- ====================================================================================

-- 1. Revenue Report
-- Aggregates revenue, meta costs, and total debits over a time range.
-- Can be grouped by: 'tenant', 'user', 'campaign', 'waba', 'category'
CREATE OR REPLACE FUNCTION get_revenue_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_group_by TEXT, -- 'tenant', 'user', 'campaign', 'category', 'source'
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    group_key TEXT,
    total_debited NUMERIC,
    total_meta_cost NUMERIC,
    total_platform_revenue NUMERIC,
    transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_group_by = 'user' THEN t.user_id::TEXT
            WHEN p_group_by = 'tenant' THEN p.signup_domain::TEXT
            WHEN p_group_by = 'campaign' THEN t.campaign_id::TEXT
            WHEN p_group_by = 'category' THEN t.wa_category::TEXT
            WHEN p_group_by = 'source' THEN t.source::TEXT
            ELSE 'ALL'
        END AS group_key,
        SUM(t.amount) AS total_debited,
        SUM(COALESCE(t.meta_cost, 0)) AS total_meta_cost,
        SUM(COALESCE(t.platform_cost, 0)) AS total_platform_revenue,
        COUNT(t.id) AS transaction_count
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain)
    GROUP BY 1
    ORDER BY total_debited DESC;
END;
$$;


-- 2. Usage Volume Report
-- Aggregates message counts and conversation counts over intervals (daily, weekly, monthly)
CREATE OR REPLACE FUNCTION get_usage_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_interval TEXT, -- 'day', 'week', 'month'
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    interval_start TIMESTAMPTZ,
    messages_sent BIGINT,
    conversations_created BIGINT,
    marketing_count BIGINT,
    utility_count BIGINT,
    service_count BIGINT,
    ai_calls BIGINT,
    voice_calls BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc(p_interval, t.created_at) AS interval_start,
        COUNT(t.id) AS messages_sent,
        COUNT(DISTINCT t.wa_conversation_id) AS conversations_created,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'MARKETING') AS marketing_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'UTILITY') AS utility_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'SERVICE') AS service_count,
        -- Dynamically tracking AI and Voice based on generic source or category markers
        COUNT(t.id) FILTER (WHERE t.source IN ('AI_CHAT', 'AI_CALL') OR t.wa_category = 'AI_CALL') AS ai_calls,
        COUNT(t.id) FILTER (WHERE t.source = 'VOICE' OR t.wa_category = 'VOICE_CALL') AS voice_calls
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain)
    GROUP BY 1
    ORDER BY 1 ASC;
END;
$$;


-- 3. Wallet Financial Summary Report
-- Calculates opening, added, consumed, refunds, and closing over a period for a tenant or globally.
CREATE OR REPLACE FUNCTION get_wallet_summary_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_added NUMERIC,
    total_consumed NUMERIC,
    total_refunded NUMERIC,
    total_adjusted NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source IN ('ADMIN_TOPUP', 'RECHARGE')) AS total_added,
        SUM(t.amount) FILTER (WHERE t.type = 'DEBIT') AS total_consumed,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'REFUND') AS total_refunded,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'ADJUSTMENT') AS total_adjusted
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain);
END;
$$;
