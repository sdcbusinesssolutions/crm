-- Fix RLS Policy for campaign_queue table to allow campaign creation

-- Enable RLS (ensure it is enabled)
ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they conflict (optional, but good practice if we are fixing)
DROP POLICY IF EXISTS "Users can insert into campaign_queue for their campaigns" ON campaign_queue;
DROP POLICY IF EXISTS "Users can view their own campaign_queue items" ON campaign_queue;

-- Allow users to insert into campaign_queue if they own the related campaign
CREATE POLICY "Users can insert into campaign_queue for their campaigns"
ON campaign_queue
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- Allow users to view their own queue items
CREATE POLICY "Users can view their own campaign_queue items"
ON campaign_queue
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);
