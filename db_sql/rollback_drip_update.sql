-- ==============================================
-- ROLLBACK SCRIPT: Revert Advanced Drip Features
-- ==============================================
-- This script removes the new columns added by complete_drip_update.sql
-- It preserves the main tables and data.

-- 1. Remove Notification & Stop At Features from Enrollments
ALTER TABLE drip_enrollments 
DROP COLUMN IF EXISTS notification_rules,
DROP COLUMN IF EXISTS notifications_sent,
DROP COLUMN IF EXISTS stop_at,
DROP COLUMN IF EXISTS is_looping;

-- 2. Remove Advanced Scheduling from Steps
ALTER TABLE drip_steps
DROP COLUMN IF EXISTS custom_time_end,
DROP COLUMN IF EXISTS custom_time_start,
DROP COLUMN IF EXISTS custom_allowed_days,
DROP COLUMN IF EXISTS use_custom_schedule,
DROP COLUMN IF EXISTS delay_unit,
DROP COLUMN IF EXISTS delay_value;

-- 3. Remove Delivery Windows from Campaigns
ALTER TABLE drip_campaigns
DROP COLUMN IF EXISTS allow_reentry,
DROP COLUMN IF EXISTS stop_on_reply,
DROP COLUMN IF EXISTS time_window_end,
DROP COLUMN IF EXISTS time_window_start,
DROP COLUMN IF EXISTS allowed_days;

-- NOTE: The main tables (drip_campaigns, drip_steps, drip_enrollments, follow_ups)
-- are NOT dropped to prevent accidental data loss of your core records.
-- If you truly want to destroy everything, you would need to run DROP TABLE explicitly.
