# 📄 PostgreSQL Performance Manifesto: WhatsApp CRM

This document contains the complete collection of SQL indexes designed to optimize the platform for high-scale performance (1,000,000+ records). These indexes eliminate sequential scans, speed up UI rendering, and prevent table locking in distributed environments.

---

## **1. 🚀 Background Engine (Workers & Campaigns)**
*Optimizes high-frequency batch processing and background scheduling.*

```sql
-- Campaign Queue: Batch fetch & lock-safe updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_queue_campaign_status_sent 
ON campaign_queue (campaign_id, status, sent_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_queue_status_retry_next 
ON campaign_queue (status, retry_count, next_retry_at) 
WHERE status = 'PENDING' OR status = 'RETRY';

-- Message ID Deduplication (Prevents duplicate outbound messages)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_queue_message_id_unique 
ON campaign_queue (message_id) WHERE message_id IS NOT NULL;

-- Drip Engine: Fast next-step scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drip_enrollments_status_next_run 
ON drip_enrollments (status, next_run_at) WHERE status = 'active';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_drip_enrollments_user_drip_contact_unique 
ON drip_enrollments (user_id, drip_campaign_id, contact_id);
```

---

## **2. 📊 Dashboard & Chart Analytics**
*Powers the 7-day traffic charts, real-time counters, and recent activity feeds.*

```sql
-- 7-Day Outbound Message Traffic Chart (Phase 2 Analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_dashboard_analytics
ON messages (conversation_id, direction, created_at DESC)
WHERE direction = 'out';

-- Latest Webhook Activity Feed (Recent Logs)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_webhook_logs_user_recent
ON webhook_logs (user_id, created_at DESC);

-- "Tasks Due Today" Dashboard Counter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tasks_dashboard_summary
ON tasks (user_id, is_completed, due_date ASC)
WHERE is_completed = false;

-- 30-Day Lead Growth Line Chart
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_user_created_analytics
ON leads (user_id, created_at DESC);
```

---

## **3. 👥 CRM & Lead Management (High Density)**
*Optimizes Kanban board sorting, contact searching, and tag filtering.*

```sql
-- Kanban Board Stage Sorting (Pre-sorts each board column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_pipeline_stage_created
ON leads (pipeline_id, stage_id, created_at DESC);

-- Pro CRM Search (Name & Phone ILIKE searching)
-- NOTE: Requires: CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_contacts_search_trgm 
ON contacts USING GIN (name gin_trgm_ops, phone gin_trgm_ops);

-- CRM Segmentation (GIN indexes for Tag and Group array searches)
CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin ON contacts USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_leads_tags_gin ON leads USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_contacts_groups_gin ON contacts USING GIN (group_ids);
```

---

## **4. 📥 Messaging & Inbox Hub**
*Powers the Inbox list, WhatsApp routing, and template caching.*

```sql
-- Inbox Conversation List (Status: Open + Newest Message First)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_conversations_status_updated
ON conversations (user_id, status, updated_at DESC);

-- Chat Window Chronological History
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_messages_conversation_created
ON messages (conversation_id, created_at DESC);

-- Global Webhook Router (User Lookup from Meta Payload)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_config_phone_id_unique
ON whatsapp_config (phone_number_id);

-- WhatsApp Template Smart-Sync API Cache
CREATE INDEX IF NOT EXISTS idx_template_cache_lookup 
ON template_components_cache (user_id, template_name, language);
```

---

## **5. 📝 Lead Profile Activity Timeline**
*Powers the chronological history window when you open a single lead's profile.*

```sql
-- Activity Timeline (Notes, Call Logs, Form Responses)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notes_lead_history ON notes (lead_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_call_logs_lead_history ON call_logs (lead_id, called_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_form_submissions_lead_history ON form_submissions (lead_id, submitted_at DESC);

-- Appointments & Meeting Scheduling
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_appointments_user_start ON appointments (user_id, start_time ASC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_user_schedule ON follow_ups (user_id, status, scheduled_at ASC);
```

---

## **6. 📁 UI Operations & Scaling**
*Ensures main navigation lists and team settings load instantly.*

```sql
-- Flow Builder List (Newest First)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flows_user_updated
ON flows (user_id, updated_at DESC);

-- Google Sheet Automations List
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sheet_automations_user_created
ON sheet_automations (user_id, created_at DESC);

-- Contacts Group List
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contact_groups_user_created
ON contact_groups (user_id, created_at DESC);

-- Team Agent Access (Dashboard Permission Checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_owner_id ON team_members (owner_id) WHERE status = 'active';
```

---

## **7. 📄 External Forms & Public Access**
*Optimizes performance for guest-facing components.*

```sql
-- Public Form Landing Page (Fast Token Lookup)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_forms_public_token ON forms (form_token);

-- WhatsApp Form Submission Storage
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_flow_submissions_user_recent 
ON whatsapp_flow_submissions (user_id, submitted_at DESC);
```

---

### **🧠 Implementation Guide**
1.  **Safety First**: Always use `CREATE INDEX CONCURRENTLY`. This allows your users to keep using the app while the index is being built.
2.  **Extensions**: Ensure `pg_trgm` is enabled for the Search index: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`.
3.  **Monitoring**: After running these, monitor the `pg_stat_user_indexes` table to see your "Index Hit Rate" climb to > 99%.

🚀 **Your Database is now technically "Enterprise Optimized".**
