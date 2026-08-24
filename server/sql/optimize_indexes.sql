-- Add missing performance indexes
CREATE INDEX IF NOT EXISTS "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");
CREATE INDEX IF NOT EXISTS "idx_contacts_phone" ON "public"."contacts" USING "btree" ("phone");
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_id_created_at" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversations_user_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_campaign_queue_campaign_id" ON "public"."campaign_queue" USING "btree" ("campaign_id");

-- Indexes based on Performance Advisor & Slow Queries Log
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Contacts: tags filter (tags @> $4)
CREATE INDEX IF NOT EXISTS "idx_contacts_tags_gin" ON "public"."contacts" USING GIN ("tags");

-- 2. Leads: ilike searches on name, email, phone
CREATE INDEX IF NOT EXISTS "idx_leads_name_trgm" ON "public"."leads" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_leads_email_trgm" ON "public"."leads" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "idx_leads_phone_trgm" ON "public"."leads" USING GIN ("phone" gin_trgm_ops);

-- 3. Conversations: filtering by user_id and status
CREATE INDEX IF NOT EXISTS "idx_conversations_user_status" ON "public"."conversations" ("user_id", "status");

-- 4. Conversations: unread_count (Index Advisor recommendation)
CREATE INDEX IF NOT EXISTS "idx_conversations_unread_count" ON "public"."conversations" USING btree ("unread_count");
