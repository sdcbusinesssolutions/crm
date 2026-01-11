-- Consolidated RLS Fixes for Campaign System

-- 1. Enable RLS on tables (idempotent)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;

DROP POLICY IF EXISTS "Users can view their own campaign_queue items" ON campaign_queue;
DROP POLICY IF EXISTS "Users can insert into campaign_queue for their campaigns" ON campaign_queue;
DROP POLICY IF EXISTS "Users can update their own campaign_queue items" ON campaign_queue;

-- 3. Campaigns Policies
CREATE POLICY "Users can view their own campaigns"
ON campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
ON campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON campaigns FOR DELETE
USING (auth.uid() = user_id);

-- 4. Campaign Queue Policies
-- Allow viewing queue items if the user owns the parent campaign
CREATE POLICY "Users can view their own campaign_queue items"
ON campaign_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Allow inserting queue items if the user owns the parent campaign
-- Note: This requires the campaign to exist first.
CREATE POLICY "Users can insert into campaign_queue for their campaigns"
ON campaign_queue FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Allow updating queue items (e.g. for status updates)
CREATE POLICY "Users can update their own campaign_queue items"
ON campaign_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- 5. Grant permissions to authenticated users (just in case)
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON campaign_queue TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE campaigns_id_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE campaign_queue_id_seq TO authenticated;
