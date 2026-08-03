-- ==============================================================================
-- CAMPAIGN ANALYSIS QUERIES
-- Instructions: Replace 'YOUR_CAMPAIGN_ID_HERE' in the param block below, 
-- then run the queries in your Supabase SQL Editor to track the campaign.
-- ==============================================================================

-- 1. Check the Total Number of Contacts in the Campaign
WITH param AS (
    SELECT 'YOUR_CAMPAIGN_ID_HERE'::uuid AS target_id
)
SELECT 
    'Total Numbers Loaded' as metric, 
    count(*) as value
FROM campaign_queue, param 
WHERE campaign_id = param.target_id;


-- 2. See the Breakdown of Statuses (Pending, Delivered, Failed, etc.)
WITH param AS (
    SELECT 'YOUR_CAMPAIGN_ID_HERE'::uuid AS target_id
)
SELECT 
    status, 
    count(*) as total
FROM campaign_queue, param 
WHERE campaign_id = param.target_id
GROUP BY status
ORDER BY total DESC;


-- 3. View the Actual Phone Numbers and their Scheduled/Sent Times (Anti-Ban Check)
WITH param AS (
    SELECT 'YOUR_CAMPAIGN_ID_HERE'::uuid AS target_id
)
SELECT 
    phone_number, 
    status, 
    next_retry_at as scheduled_time, 
    sent_at as actual_sent_time
FROM campaign_queue, param 
WHERE campaign_id = param.target_id
ORDER BY next_retry_at ASC
LIMIT 100;
