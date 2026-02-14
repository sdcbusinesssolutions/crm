-- Optimizing Dashboard Performance via Indices

-- 1. Leads Table Indices (Covering & Sorted)
-- Used for fetching active leads, leads created today, and recent leads
CREATE INDEX IF NOT EXISTS idx_leads_user_status ON leads(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_user_created_at ON leads(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_user_stage ON leads(user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_pipeline ON leads(user_id, pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_id, stage_id);

-- 2. Contacts Table Index
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);

-- 3. Messages & Conversations
CREATE INDEX IF NOT EXISTS idx_messages_created_at_direction ON messages(created_at, direction);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);

-- 4. Campaign & Workflow Tables
CREATE INDEX IF NOT EXISTS idx_campaigns_user_created ON campaigns(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flows_user_id ON flows(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON whatsapp_templates(user_id);

-- 5. Tasks Table
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_completed ON tasks(user_id, is_completed);

-- 6. Pipelines & Stages
CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_pipeline ON pipeline_stages(user_id, pipeline_id);

-- 7. Lead Dashboard Specifics (New)
CREATE INDEX IF NOT EXISTS idx_contact_groups_user_id ON contact_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_forms_user_id ON forms(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);

-- 8. Lead Dashboard Specific Optimizations (Added now)
-- Optimized for aggregation queries
CREATE INDEX IF NOT EXISTS idx_leads_user_source ON leads(user_id, source);
CREATE INDEX IF NOT EXISTS idx_leads_user_tags ON leads(user_id); -- Tags is jsonb or string, might not index perfectly without trigram but basic b-tree helps.
-- Covering index for pipeline stats
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage_val ON leads(user_id, pipeline_id, stage_id) INCLUDE (estimated_value);
