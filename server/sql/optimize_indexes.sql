-- Add missing performance indexes
CREATE INDEX IF NOT EXISTS "idx_leads_phone" ON "public"."leads" USING "btree" ("phone");
CREATE INDEX IF NOT EXISTS "idx_contacts_phone" ON "public"."contacts" USING "btree" ("phone");
CREATE INDEX IF NOT EXISTS "idx_messages_conversation_id_created_at" ON "public"."messages" USING "btree" ("conversation_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversations_user_updated" ON "public"."conversations" USING "btree" ("user_id", "updated_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_campaign_queue_campaign_id" ON "public"."campaign_queue" USING "btree" ("campaign_id");
