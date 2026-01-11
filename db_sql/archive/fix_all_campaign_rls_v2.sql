-- Consolidated RLS Fixes for Campaign System (Single File)

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
CREATE POLICY "Users can view their own campaign_queue items"
ON campaign_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert into campaign_queue for their campaigns"
ON campaign_queue FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own campaign_queue items"
ON campaign_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- 5. Grant permissions (Fixed: Removed sequence grants if they don't exist)
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON campaign_queue TO authenticated;
-- Only grant on sequences if they exist (Postgres doesn't support IF EXISTS for GRANT easily, so we skip explicit sequence grants)
-- Usually, granting ALL on the table is enough for serial columns if the user owns the table or if defaults are handled by the system.
-- If explicit sequence access is needed, it depends on the exact sequence name which might differ.
-- We will rely on the table grants.
