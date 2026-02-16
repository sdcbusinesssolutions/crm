-- Function to handle inbound WhatsApp message in a single transaction
-- This replaces multiple round-trips for Contact Upsert + Conversation Upsert + Message Insert

CREATE OR REPLACE FUNCTION handle_inbound_message(
    p_user_id UUID,
    p_contact_phone TEXT,
    p_contact_name TEXT,
    p_message_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of the creator
AS $$
DECLARE
    v_contact_id UUID;
    v_conversation_id UUID;
    v_message_id UUID;
    v_unread_count INT;
BEGIN
    -- 1. UPSERT CONTACT
    -- Logic: If exists, update name (if provided) and last_active. If not, insert.
    INSERT INTO contacts (user_id, phone, name, status, last_active, "group_tags")
    VALUES (
        p_user_id, 
        p_contact_phone, 
        COALESCE(p_contact_name, p_contact_phone), 
        'active', 
        (p_message_payload->>'created_at')::TIMESTAMPTZ,
        '[]'::jsonb
    )
    ON CONFLICT (user_id, phone) 
    DO UPDATE SET 
        name = CASE 
            WHEN p_contact_name IS NOT NULL AND p_contact_name <> '~' AND p_contact_name <> '' THEN p_contact_name 
            ELSE contacts.name 
        END,
        last_active = GREATEST(contacts.last_active, (p_message_payload->>'created_at')::TIMESTAMPTZ),
        status = 'active'
    RETURNING id INTO v_contact_id;

    -- 2. UPSERT CONVERSATION
    -- Logic: If exists, increment unread_count and update last_message. If not, insert.
    INSERT INTO conversations (user_id, contact_phone, contact_name, last_message, unread_count, updated_at)
    VALUES (
        p_user_id, 
        p_contact_phone, 
        COALESCE(p_contact_name, p_contact_phone), 
        p_message_payload->>'preview_text', 
        1, 
        (p_message_payload->>'created_at')::TIMESTAMPTZ
    )
    ON CONFLICT (user_id, contact_phone)
    DO UPDATE SET 
        last_message = p_message_payload->>'preview_text',
        unread_count = conversations.unread_count + 1,
        updated_at = (p_message_payload->>'created_at')::TIMESTAMPTZ,
        contact_name = CASE 
            WHEN p_contact_name IS NOT NULL AND p_contact_name <> '~' AND p_contact_name <> '' THEN p_contact_name 
            ELSE conversations.contact_name 
        END
    RETURNING id INTO v_conversation_id;

    -- 3. INSERT MESSAGE
    INSERT INTO messages (
        conversation_id,
        direction,
        type,
        text,
        media_url,
        filename,
        mime_type,
        whatsapp_message_id,
        status,
        created_at,
        latitude,
        longitude
    )
    VALUES (
        v_conversation_id,
        'in',
        p_message_payload->>'type',
        p_message_payload->>'text',
        p_message_payload->>'media_url',
        p_message_payload->>'filename',
        p_message_payload->>'mime_type',
        p_message_payload->>'whatsapp_message_id',
        'delivered',
        (p_message_payload->>'created_at')::TIMESTAMPTZ,
        (p_message_payload->>'latitude')::FLOAT,
        (p_message_payload->>'longitude')::FLOAT
    )
    RETURNING id INTO v_message_id;

    RETURN jsonb_build_object(
        'status', 'success',
        'contact_id', v_contact_id,
        'conversation_id', v_conversation_id,
        'message_id', v_message_id
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'status', 'error',
        'message', SQLERRM
    );
END;
$$;
