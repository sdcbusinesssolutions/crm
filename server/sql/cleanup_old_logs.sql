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
