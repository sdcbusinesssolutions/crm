-- 1. Deduplicate Existing Queue Items
-- (Keep the one with the smallest ID, delete others)
DELETE FROM campaign_queue a USING campaign_queue b
WHERE a.id > b.id
AND a.campaign_id = b.campaign_id
AND a.phone_number = b.phone_number;

-- 2. Add Unique Index Constraint
-- This ensures no future duplicates can be inserted for the same (campaign, phone) pair.
ALTER TABLE campaign_queue ADD CONSTRAINT idx_unique_campaign_phone UNIQUE (campaign_id, phone_number);
