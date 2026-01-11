CREATE OR REPLACE FUNCTION public.update_message_status(
    p_whatsapp_message_id TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update Messages Table (Chat History)
    UPDATE public.messages
    SET status = p_status,
        updated_at = NOW()
    WHERE whatsapp_message_id = p_whatsapp_message_id;

    -- 2. Update Campaign Queue (Campaign Stats)
    -- Only updates if the message ID exists in the queue (i.e. it was sent via campaign)
    UPDATE public.campaign_queue
    SET status = UPPER(p_status), -- Campaign queue uses uppercase (SENT, DELIVERED, READ)
        updated_at = NOW()
    WHERE message_id = p_whatsapp_message_id;

    RETURN FOUND;
END;
$$;
