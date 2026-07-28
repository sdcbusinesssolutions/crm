-- This script can be used to fix campaigns that were prematurely marked as COMPLETED
-- due to a race condition where the campaign worker checked the queue before contacts were fully inserted.

-- 1. Identify and fix campaigns that are marked as COMPLETED but still have PENDING items in the queue
-- (This sets them to PROCESSING so the worker can pick them up and send the messages)
UPDATE campaigns c
SET status = 'PROCESSING'
WHERE c.status = 'COMPLETED'
  AND EXISTS (
    SELECT 1 FROM campaign_queue q 
    WHERE q.campaign_id = c.id 
    AND q.status = 'PENDING'
  );

-- 2. Optional: If you want to stop them from sending immediately after fixing, you can set them to PAUSED
-- UPDATE campaigns c
-- SET status = 'PAUSED'
-- WHERE c.status = 'PROCESSING'
--   AND EXISTS (
--     SELECT 1 FROM campaign_queue q 
--     WHERE q.campaign_id = c.id 
--     AND q.status = 'PENDING'
--   );
