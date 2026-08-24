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
WHERE created_at < NOW() - INTERVAL '4 months'
  AND status IN ('completed', 'cancelled', 'failed');

-- 3. Run VACUUM to reclaim the physical disk space immediately
-- NOTE: VACUUM FULL will lock the tables while it runs, so it might cause brief downtime.
-- If you just run standard VACUUM (without FULL), it frees space for future inserts but doesn't shrink the file size.
VACUUM public.campaign_queue;
VACUUM public.campaigns;
