-- ==========================================
-- Performance Optimization for Inbox
-- ==========================================
-- This migration adds indexes to improve inbox message loading performance

-- Index for fetching messages by conversation_id (most common query)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);

-- Index for fetching conversations by user_id
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated 
ON conversations(user_id, updated_at DESC);

-- Index for unread message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_direction_status 
ON messages(conversation_id, direction, status);

-- Index for WhatsApp message ID lookups (used in status updates)
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_id 
ON messages(whatsapp_message_id) 
WHERE whatsapp_message_id IS NOT NULL;

-- Analyze tables to update statistics for query planner
ANALYZE messages;
ANALYZE conversations;

-- Add comments for documentation
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimizes message fetching for inbox conversations';
COMMENT ON INDEX idx_conversations_user_updated IS 'Optimizes conversation list loading';
COMMENT ON INDEX idx_messages_conversation_direction_status IS 'Optimizes unread message counting';
COMMENT ON INDEX idx_messages_whatsapp_id IS 'Optimizes WhatsApp status update lookups';
