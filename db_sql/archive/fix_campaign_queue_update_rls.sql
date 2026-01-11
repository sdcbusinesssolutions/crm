-- Allow users to update their own queue items (needed for processing status updates)
CREATE POLICY "Users can update their own campaign_queue items"
ON campaign_queue
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);
