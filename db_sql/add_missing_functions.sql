-- Add missing functions from backup to schema
-- These functions are critical for Chatbot, Forms, and Message handling

-- 1. cancel_active_sessions
CREATE OR REPLACE FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET status = 'aborted',
        last_interaction_at = NOW()
    WHERE contact_phone = p_contact_phone
      AND (status = 'active' OR status = 'waiting_input');
END;
$$;
ALTER FUNCTION "public"."cancel_active_sessions"("p_contact_phone" "text") OWNER TO "postgres";

-- 2. create_flow_session
CREATE OR REPLACE FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_result JSONB;
    v_id UUID;
BEGIN
    INSERT INTO flow_sessions (user_id, contact_phone, flow_id, current_node_id, status, variables)
    VALUES (p_user_id, p_contact_phone, p_flow_id, p_current_node_id, 'active', p_variables)
    RETURNING id INTO v_id;

    SELECT to_jsonb(fs.*) INTO v_result FROM flow_sessions fs WHERE id = v_id;
    RETURN v_result;
END;
$$;
ALTER FUNCTION "public"."create_flow_session"("p_user_id" "uuid", "p_contact_phone" "text", "p_flow_id" "uuid", "p_current_node_id" "text", "p_variables" "jsonb") OWNER TO "postgres";

-- 3. find_flow_by_webhook_id
CREATE OR REPLACE FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.user_id, f.name, f.nodes, f.edges, f.status
    FROM flows f
    WHERE f.nodes @> ('[{"data": {"webhookId": "' || p_webhook_id || '"}}]')::jsonb;
END;
$$;
ALTER FUNCTION "public"."find_flow_by_webhook_id"("p_webhook_id" "text") OWNER TO "postgres";

-- 4. get_active_owner_id
CREATE OR REPLACE FUNCTION "public"."get_active_owner_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    SELECT owner_id INTO v_owner_id
    FROM public.team_members
    WHERE user_id = auth.uid() AND status = 'active'
    LIMIT 1;
    RETURN COALESCE(v_owner_id, auth.uid());
END;
$$;
ALTER FUNCTION "public"."get_active_owner_id"() OWNER TO "postgres";

-- 5. get_active_session
CREATE OR REPLACE FUNCTION "public"."get_active_session"("p_contact_phone" "text") RETURNS TABLE("id" "uuid", "user_id" "uuid", "contact_phone" "text", "flow_id" "uuid", "current_node_id" "text", "status" "text", "variables" "jsonb", "created_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT fs.id, fs.user_id, fs.contact_phone, fs.flow_id, fs.current_node_id, fs.status, fs.variables, fs.created_at, fs.last_interaction_at
    FROM flow_sessions fs
    WHERE fs.contact_phone = p_contact_phone
      AND fs.status = 'waiting_input'
    ORDER BY fs.created_at DESC
    LIMIT 1;
END;
$$;
ALTER FUNCTION "public"."get_active_session"("p_contact_phone" "text") OWNER TO "postgres";

-- 6. get_flow_by_id
CREATE OR REPLACE FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text", "trigger_keywords" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.id = p_flow_id;
END;
$$;
ALTER FUNCTION "public"."get_flow_by_id"("p_flow_id" "uuid") OWNER TO "postgres";

-- 7. get_flow_by_keyword
CREATE OR REPLACE FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") RETURNS TABLE("id" "uuid", "name" "text", "nodes" "jsonb", "edges" "jsonb", "status" "text", "trigger_keywords" "text"[])
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.user_id = p_user_id
      -- Check status case-insensitively (Published, published, PUBLISHED)
      AND LOWER(f.status) = 'published'
      -- Check keyword containment
      AND f.trigger_keywords @> ARRAY[LOWER(p_keyword)];
END;
$$;
ALTER FUNCTION "public"."get_flow_by_keyword"("p_keyword" "text", "p_user_id" "uuid") OWNER TO "postgres";

-- 8. get_latest_webhook_log
CREATE OR REPLACE FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") RETURNS TABLE("raw_payload" "jsonb", "created_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    RETURN QUERY
    SELECT wl.raw_payload, wl.created_at
    FROM public.webhook_logs wl
    WHERE wl.webhook_id = p_webhook_id
    ORDER BY wl.created_at DESC
    LIMIT 1;
END;
$$;
ALTER FUNCTION "public"."get_latest_webhook_log"("p_webhook_id" "text") OWNER TO "postgres";

-- 9. get_my_org_ids
CREATE OR REPLACE FUNCTION "public"."get_my_org_ids"() RETURNS "uuid"[]
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN ARRAY(
    SELECT org_id 
    FROM public.org_members 
    WHERE user_id = auth.uid()
  );
END;
$$;
ALTER FUNCTION "public"."get_my_org_ids"() OWNER TO "postgres";

-- 10. get_verify_token
CREATE OR REPLACE FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT verify_token INTO v_token
  FROM public.whatsapp_config
  WHERE user_id = p_user_id AND phone_number_id = p_phone_number_id
  LIMIT 1;
  
  RETURN v_token;
END;
$$;
ALTER FUNCTION "public"."get_verify_token"("p_user_id" "uuid", "p_phone_number_id" "text") OWNER TO "postgres";

-- 11. get_whatsapp_config
CREATE OR REPLACE FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_config JSONB;
BEGIN
    IF p_phone_number_id IS NOT NULL THEN
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        AND wc.phone_number_id = p_phone_number_id
        LIMIT 1;
    ELSE
        -- If no phone number ID provided, return the first one found for the user
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        LIMIT 1;
    END IF;

    RETURN v_config;
END;
$$;
ALTER FUNCTION "public"."get_whatsapp_config"("p_user_id" "uuid", "p_phone_number_id" "text") OWNER TO "postgres";

-- 12. handle_inbound_message (CRITICAL)
CREATE OR REPLACE FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_filename" "text" DEFAULT NULL::"text", "p_mime_type" "text" DEFAULT NULL::"text", "p_latitude" double precision DEFAULT NULL::double precision, "p_longitude" double precision DEFAULT NULL::double precision, "p_timestamp" timestamp with time zone DEFAULT "now"()) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_conversation_id UUID;
    v_conversation_unread_count INTEGER;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id, unread_count INTO v_conversation_id, v_conversation_unread_count
    FROM public.conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (
            user_id,
            contact_phone,
            contact_name,
            last_message,
            unread_count,
            status,
            updated_at
        ) VALUES (
            p_user_id,
            p_contact_phone,
            p_contact_name,
            COALESCE(p_message_text, '[' || p_message_type || ']'),
            1,
            'open',
            NOW()
        ) RETURNING id INTO v_conversation_id;
    ELSE
        UPDATE public.conversations
        SET last_message = COALESCE(p_message_text, '[' || p_message_type || ']'),
            unread_count = COALESCE(v_conversation_unread_count, 0) + 1,
            updated_at = NOW()
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO public.messages (
        conversation_id,
        type,
        text,
        media_url,
        filename,
        mime_type,
        latitude,
        longitude,
        direction,
        status,
        created_at
    ) VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        p_filename,
        p_mime_type,
        p_latitude,
        p_longitude,
        'in',
        'delivered',
        p_timestamp
    ) RETURNING id INTO v_message_id;

    RETURN jsonb_build_object(
        'conversation_id', v_conversation_id,
        'message_id', v_message_id
    );
END;
$$;
ALTER FUNCTION "public"."handle_inbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_contact_name" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_filename" "text", "p_mime_type" "text", "p_latitude" double precision, "p_longitude" double precision, "p_timestamp" timestamp with time zone) OWNER TO "postgres";

-- 13. log_outbound_message
CREATE OR REPLACE FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text" DEFAULT NULL::"text", "p_media_url" "text" DEFAULT NULL::"text", "p_status" "text" DEFAULT 'sent'::"text", "p_whatsapp_message_id" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_conversation_id UUID;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (user_id, contact_phone, status, unread_count, last_message, updated_at)
        VALUES (p_user_id, p_contact_phone, 'open', 0, 'Outbound Message', NOW())
        RETURNING id INTO v_conversation_id;
    ELSE
        -- Update conversation timestamp
        UPDATE conversations
        SET updated_at = NOW(),
            last_message = COALESCE(p_message_text, 'Sent ' || p_message_type)
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO messages (
        conversation_id,
        type,
        text,
        media_url,
        direction,
        status,
        whatsapp_message_id,
        created_at
    )
    VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        'out',
        p_status,
        p_whatsapp_message_id,
        NOW()
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;
ALTER FUNCTION "public"."log_outbound_message"("p_user_id" "uuid", "p_contact_phone" "text", "p_message_type" "text", "p_message_text" "text", "p_media_url" "text", "p_status" "text", "p_whatsapp_message_id" "text") OWNER TO "postgres";

-- 14. update_session_step
CREATE OR REPLACE FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET current_node_id = p_current_node_id,
        status = p_status,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;
ALTER FUNCTION "public"."update_session_step"("p_session_id" "uuid", "p_current_node_id" "text", "p_status" "text") OWNER TO "postgres";

-- 15. update_session_variables
CREATE OR REPLACE FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    UPDATE flow_sessions
    SET variables = p_variables,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;
ALTER FUNCTION "public"."update_session_variables"("p_session_id" "uuid", "p_variables" "jsonb") OWNER TO "postgres";

-- 16. update_flow_keywords (Trigger Function)
CREATE OR REPLACE FUNCTION "public"."update_flow_keywords"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    keywords text[];
BEGIN
    -- Extract 'keywords' from 'onMessage' nodes
    SELECT ARRAY_AGG(DISTINCT LOWER(k))
    INTO keywords
    FROM jsonb_array_elements(NEW.nodes) AS n(data),
         jsonb_array_elements_text(n.data->'data'->'keywords') AS k
    WHERE n.data->>'type' = 'onMessage';

    -- Update the dedicated column
    NEW.trigger_keywords := COALESCE(keywords, '{}');
    RETURN NEW;
END;
$$;
ALTER FUNCTION "public"."update_flow_keywords"() OWNER TO "postgres";

-- 17. Re-apply the trigger (Safe Drop)
DROP TRIGGER IF EXISTS update_flow_keywords_trigger ON public.flows;
CREATE TRIGGER update_flow_keywords_trigger
    BEFORE INSERT OR UPDATE ON public.flows
    FOR EACH ROW
    EXECUTE FUNCTION public.update_flow_keywords();
