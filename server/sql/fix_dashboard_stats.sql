-- 1. Create or Replace the RPC function to update BOTH tables
-- DROP first to avoid "cannot change return type" error
DROP FUNCTION IF EXISTS update_message_status(text, text);

CREATE OR REPLACE FUNCTION update_message_status(
    p_whatsapp_message_id TEXT,
    p_status TEXT
)
RETURNS VOID AS $$
BEGIN
    -- 1. Update the Inbox Messages table (used for Chat)
    UPDATE messages 
    SET status = p_status 
    WHERE whatsapp_message_id = p_whatsapp_message_id;

    -- 2. Update the Campaign Queue table (used for Dashboard Stats)
    UPDATE campaign_queue 
    SET status = UPPER(p_status), -- Ensure UPPERCASE for consistency (SENT, READ, DELIVERED)
        updated_at = NOW()
    WHERE message_id = p_whatsapp_message_id;

END;
$$ LANGUAGE plpgsql;

-- 2. Run this ONCE to fix existing discrepancies
-- (Syncs campaign_queue status from messages table if they differ)
UPDATE campaign_queue q
SET status = UPPER(m.status)
FROM messages m
WHERE q.message_id = m.whatsapp_message_id
AND q.message_id IS NOT NULL
AND UPPER(m.status) IN ('SENT', 'DELIVERED', 'READ', 'FAILED')
AND q.status != UPPER(m.status);
