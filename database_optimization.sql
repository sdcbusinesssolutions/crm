-- Optimizing Dashboard Performance via Indices

-- 1. Leads Table Indices
-- Used for fetching active leads, leads created today, and recent leads
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_user_created_at ON leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads(user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_pipeline ON leads(user_id, pipeline_id);

-- 2. Contacts Table Index
-- Used for total contacts count
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- 3. Messages & Conversations
-- Used for 7-day traffic chart
-- Note: 'messages' queries filtered by 'direction' and 'created_at', and joined with 'conversations'
CREATE INDEX IF NOT EXISTS idx_messages_created_at_direction ON messages(created_at, direction);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- 4. Campaign & Workflow Tables
-- Used for counts and lists
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created ON campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON whatsapp_templates(user_id);

-- 5. Tasks Table
-- Used for follow-up stats
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, is_completed);

-- 6. Pipelines & Stages
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_pipeline ON pipeline_stages(user_id, pipeline_id);
