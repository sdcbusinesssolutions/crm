-- Run this on your production database via the Supabase SQL Editor
CREATE OR REPLACE VIEW conversations_with_leads AS
SELECT 
  c.id, 
  c.user_id, 
  c.contact_phone, 
  c.contact_name, 
  c.last_message, 
  c.unread_count, 
  c.status, 
  c.tags, 
  c.assigned_to, 
  c.created_at, 
  c.updated_at, 
  c.lead_status, 
  c.lead_summary, 
  c.assigned_ai_agent_id, 
  c.bot_paused_until,
  l.assigned_staff_ids
FROM conversations c
LEFT JOIN leads l ON c.user_id = l.user_id AND c.contact_phone = l.phone;