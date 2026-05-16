-- =================================================================
-- COMPLETE DATABASE FIX: CASCADE DELETES FOR ALL TABLES
-- =================================================================
-- This script adds ON DELETE CASCADE to every table referencing auth.users
-- based on your provided schema. This ensures user deletion works perfectly.
-- =================================================================

DO $$ 
DECLARE
    t_name TEXT;
    c_name TEXT;
BEGIN
    -- List of tables and their specific FK constraint names for auth.users
    -- We drop them and recreate them with ON DELETE CASCADE
    
    -- 1. appointments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'appointments') THEN
        ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_user_id_fkey;
        ALTER TABLE public.appointments ADD CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 2. branding_settings
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branding_settings') THEN
        ALTER TABLE public.branding_settings DROP CONSTRAINT IF EXISTS branding_settings_user_id_fkey;
        ALTER TABLE public.branding_settings ADD CONSTRAINT branding_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 3. call_logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'call_logs') THEN
        ALTER TABLE public.call_logs DROP CONSTRAINT IF EXISTS call_logs_user_id_fkey;
        ALTER TABLE public.call_logs ADD CONSTRAINT call_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 4. campaigns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaigns') THEN
        ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_user_id_fkey;
        ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 5. contact_groups
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_groups') THEN
        ALTER TABLE public.contact_groups DROP CONSTRAINT IF EXISTS contact_groups_user_id_fkey;
        ALTER TABLE public.contact_groups ADD CONSTRAINT contact_groups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 6. contacts
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contacts') THEN
        ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_user_id_fkey;
        ALTER TABLE public.contacts ADD CONSTRAINT contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 7. conversations (Multiple FKs: assigned_to and user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations') THEN
        ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
        ALTER TABLE public.conversations ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_assigned_to_fkey;
        ALTER TABLE public.conversations ADD CONSTRAINT conversations_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 8. custom_fields
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'custom_fields') THEN
        ALTER TABLE public.custom_fields DROP CONSTRAINT IF EXISTS custom_fields_user_id_fkey;
        ALTER TABLE public.custom_fields ADD CONSTRAINT custom_fields_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 9. drip_campaigns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'drip_campaigns') THEN
        ALTER TABLE public.drip_campaigns DROP CONSTRAINT IF EXISTS drip_campaigns_user_id_fkey;
        ALTER TABLE public.drip_campaigns ADD CONSTRAINT drip_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 10. flow_sessions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flow_sessions') THEN
        ALTER TABLE public.flow_sessions DROP CONSTRAINT IF EXISTS flow_sessions_user_id_fkey;
        ALTER TABLE public.flow_sessions ADD CONSTRAINT flow_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 11. flows
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'flows') THEN
        ALTER TABLE public.flows DROP CONSTRAINT IF EXISTS flows_user_id_fkey;
        ALTER TABLE public.flows ADD CONSTRAINT flows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 12. follow_ups
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follow_ups') THEN
        ALTER TABLE public.follow_ups DROP CONSTRAINT IF EXISTS follow_ups_user_id_fkey;
        ALTER TABLE public.follow_ups ADD CONSTRAINT follow_ups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 13. followup_campaigns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followup_campaigns') THEN
        ALTER TABLE public.followup_campaigns DROP CONSTRAINT IF EXISTS followup_campaigns_user_id_fkey;
        ALTER TABLE public.followup_campaigns ADD CONSTRAINT followup_campaigns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 14. followup_enrollments
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'followup_enrollments') THEN
        ALTER TABLE public.followup_enrollments DROP CONSTRAINT IF EXISTS followup_enrollments_user_id_fkey;
        ALTER TABLE public.followup_enrollments ADD CONSTRAINT followup_enrollments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 15. forms (user_id and default_owner_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'forms') THEN
        ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_user_id_fkey;
        ALTER TABLE public.forms ADD CONSTRAINT forms_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        ALTER TABLE public.forms DROP CONSTRAINT IF EXISTS forms_default_owner_id_fkey;
        ALTER TABLE public.forms ADD CONSTRAINT forms_default_owner_id_fkey FOREIGN KEY (default_owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 16. integration_facebook_pages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'integration_facebook_pages') THEN
        ALTER TABLE public.integration_facebook_pages DROP CONSTRAINT IF EXISTS integration_facebook_pages_user_id_fkey;
        ALTER TABLE public.integration_facebook_pages ADD CONSTRAINT integration_facebook_pages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 17. leads
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
        ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_user_id_fkey;
        ALTER TABLE public.leads ADD CONSTRAINT leads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 18. meta_limits
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'meta_limits') THEN
        ALTER TABLE public.meta_limits DROP CONSTRAINT IF EXISTS meta_limits_user_id_fkey;
        ALTER TABLE public.meta_limits ADD CONSTRAINT meta_limits_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 19. notes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notes') THEN
        ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_user_id_fkey;
        ALTER TABLE public.notes ADD CONSTRAINT notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 20. pipeline_stages
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipeline_stages') THEN
        ALTER TABLE public.pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stages_user_id_fkey;
        ALTER TABLE public.pipeline_stages ADD CONSTRAINT pipeline_stages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 21. pipelines
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pipelines') THEN
        ALTER TABLE public.pipelines DROP CONSTRAINT IF EXISTS pipelines_user_id_fkey;
        ALTER TABLE public.pipelines ADD CONSTRAINT pipelines_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 22. quick_replies
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'quick_replies') THEN
        ALTER TABLE public.quick_replies DROP CONSTRAINT IF EXISTS quick_replies_user_id_fkey;
        ALTER TABLE public.quick_replies ADD CONSTRAINT quick_replies_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 23. tags
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tags') THEN
        ALTER TABLE public.tags DROP CONSTRAINT IF EXISTS tags_user_id_fkey;
        ALTER TABLE public.tags ADD CONSTRAINT tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 24. tasks
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tasks') THEN
        ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_user_id_fkey;
        ALTER TABLE public.tasks ADD CONSTRAINT tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 25. team_members (owner_id and user_id)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'team_members') THEN
        ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_owner_id_fkey;
        ALTER TABLE public.team_members ADD CONSTRAINT team_members_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_user_id_fkey;
        ALTER TABLE public.team_members ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 26. user_integrations
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_integrations') THEN
        ALTER TABLE public.user_integrations DROP CONSTRAINT IF EXISTS user_integrations_user_id_fkey;
        ALTER TABLE public.user_integrations ADD CONSTRAINT user_integrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 27. user_security
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_security') THEN
        ALTER TABLE public.user_security DROP CONSTRAINT IF EXISTS user_security_user_id_fkey;
        ALTER TABLE public.user_security ADD CONSTRAINT user_security_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 28. user_subscriptions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_subscriptions') THEN
        ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;
        ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 29. webhook_logs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'webhook_logs') THEN
        ALTER TABLE public.webhook_logs DROP CONSTRAINT IF EXISTS webhook_logs_user_id_fkey;
        ALTER TABLE public.webhook_logs ADD CONSTRAINT webhook_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 30. whatsapp_config
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_config') THEN
        ALTER TABLE public.whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_fkey;
        ALTER TABLE public.whatsapp_config ADD CONSTRAINT whatsapp_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 31. whatsapp_flow_submissions
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_flow_submissions') THEN
        ALTER TABLE public.whatsapp_flow_submissions DROP CONSTRAINT IF EXISTS whatsapp_flow_submissions_user_id_fkey;
        ALTER TABLE public.whatsapp_flow_submissions ADD CONSTRAINT whatsapp_flow_submissions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 32. whatsapp_templates
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_templates') THEN
        ALTER TABLE public.whatsapp_templates DROP CONSTRAINT IF EXISTS whatsapp_templates_user_id_fkey;
        ALTER TABLE public.whatsapp_templates ADD CONSTRAINT whatsapp_templates_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    -- 33. campaign_media (From previous context)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'campaign_media') THEN
        ALTER TABLE public.campaign_media DROP CONSTRAINT IF EXISTS campaign_media_user_id_fkey;
        ALTER TABLE public.campaign_media ADD CONSTRAINT campaign_media_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

END $$;

-- =================================================================
-- CRITICAL: Sync missing emails to Profiles table
-- =================================================================
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id 
AND (p.email IS NULL OR p.email = '');

-- =================================================================
-- VERIFICATION QUERY
-- =================================================================
SELECT
    tc.table_name,
    rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
WHERE ccu.table_schema = 'auth' AND ccu.table_name = 'users'
AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name;
