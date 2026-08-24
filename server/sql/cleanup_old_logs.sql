-- ============================================================================
-- 🧹 Cleanup Script: Delete Old Logs & Sessions (Older than 5 Days)
-- ============================================================================

-- 1. Cleanup Flow Sessions 
-- (Keep active sessions? Or hard delete everything old? Usually old sessions are dead.)
DELETE FROM public.flow_sessions 
WHERE created_at < NOW() - INTERVAL '5 days';

-- 2. Cleanup Webhook Logs (High volume table)
DELETE FROM public.webhook_logs 
WHERE created_at < NOW() - INTERVAL '5 days';

-- 3. Cleanup Cron Job History (If pg_cron is used, this grows fast)
-- We wrap in DO block to avoid error if table doesn't exist or is inaccessible
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'cron' AND tablename = 'job_run_details') THEN
        DELETE FROM cron.job_run_details WHERE end_time < NOW() - INTERVAL '5 days';
    END IF;
END $$;

-- 4. Cleanup Storage Files (Buckets)
-- Deletes files from 'campaign-media' uploaded more than 10 days ago.
-- Deleting the row in storage.objects removes the file from the Supabase interface.
DELETE FROM storage.objects 
WHERE bucket_id = 'campaign-media' 
  AND created_at < NOW() - INTERVAL '20 days';


-- ============================================================================
-- 🧹 Cleanup Script: Delete Old Campaigns & Queue to Free Up Disk Space
-- ============================================================================

-- 1. Delete all items from the campaign queue that are older than 4 months
-- This is usually the largest table in the database.
-- We only delete processed items (not 'pending' just in case).
DELETE FROM public.campaign_queue 
WHERE created_at < NOW() - INTERVAL '4 months'
  AND status != 'pending';

-- 2. Optional: Delete the campaigns themselves if they are older than 4 months
-- WARNING: This will also delete historical campaign reports for those old campaigns.
-- If you want to keep the campaign names and stats but delete the queue, comment this out.
DELETE FROM public.campaigns 
WHERE created_at < NOW() - INTERVAL '3 months'
  AND status IN ('completed', 'cancelled', 'failed');

-- 3. Run VACUUM to reclaim the physical disk space immediately
-- NOTE: VACUUM FULL will lock the tables while it runs, so it might cause brief downtime.
-- If you just run standard VACUUM (without FULL), it frees space for future inserts but doesn't shrink the file size.
VACUUM public.campaign_queue;
VACUUM public.campaigns;



DELETE FROM flow_sessions 
WHERE status = 'completed' 
AND created_at < NOW() - INTERVAL '1 days';


SELECT id, title, status 
FROM campaigns 
WHERE 
 status NOT IN ('COMPLETED', 'CANCELLED', 'FAILED');

-- ============================================================================
-- 🧹 Disk Space Cleanup: Delete Old Messages & Conversations
-- ============================================================================

-- 1. Delete old messages (Takes up 48% of your disk space)
-- Change '6 months' to whatever duration you are comfortable with
DELETE FROM public.messages 
WHERE created_at < NOW() - INTERVAL '6 months';

-- 2. Delete old conversations (Takes up 11% of your disk space)
-- Make sure to run this AFTER deleting messages to avoid foreign key errors.
DELETE FROM public.conversations 
WHERE updated_at < NOW() - INTERVAL '6 months';

-- 3. Run VACUUM to reclaim space physically
-- VACUUM FULL public.messages;
-- VACUUM FULL public.conversations;

-- 1. Pehle messages delete karein taaki foreign key ka error na aaye
DELETE FROM public.messages 
WHERE created_at < NOW() - INTERVAL '6 months';

-- 2. Uske baad purani conversations delete karein
DELETE FROM public.conversations 
WHERE updated_at < NOW() - INTERVAL '6 months';


VACUUM public.messages;
VACUUM public.conversations;

-- ============================================================================
-- 🧹 Disk Space Cleanup: Delete Old Sheet Automation History
-- ============================================================================

-- Delete history older than 1 month (or whatever duration you prefer)
DELETE FROM public.sheet_automation_history 
WHERE sent_at < NOW() - INTERVAL '1 months';

-- Shrink the table to reclaim space
VACUUM FULL public.sheet_automation_history;
