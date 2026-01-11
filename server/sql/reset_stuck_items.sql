-- 1. Reset Stuck "SENDING" items to "PENDING"
-- Run this if items are stuck in 'SENDING' for a long time (e.g. after a server crash).
UPDATE campaign_queue
SET status = 'PENDING'
WHERE status = 'SENDING';
