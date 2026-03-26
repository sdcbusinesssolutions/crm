-- ==============================================
-- UI PERFORMANCE OPTIMIZATION INDEXES
-- PURPOSE: Ensure Drip list and Graph Builder open instantly
-- ==============================================

-- 1. Fast Drip Campaign Listing (Dashboard)
CREATE INDEX IF NOT EXISTS idx_drip_campaigns_user_id ON public.drip_campaigns(user_id);

-- 2. Fast Graph Builder Loading (Fetching all steps for a campaign)
CREATE INDEX IF NOT EXISTS idx_drip_steps_campaign_id ON public.drip_steps(drip_campaign_id);

-- 3. Fast Enrollments Tab (Fetching leads in a specific campaign)
CREATE INDEX IF NOT EXISTS idx_drip_enrollments_campaign_id ON public.drip_enrollments(drip_campaign_id);

-- 4. Fast Contact Lookup (For trigger resolution)
CREATE INDEX IF NOT EXISTS idx_contacts_user_phone ON public.contacts(user_id, phone);
