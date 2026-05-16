-- =================================================================
-- FIX: Add missing columns to messages table
-- =================================================================
-- The inbox code expects 'metadata' and 'user_id' columns on messages.
-- metadata: stores template info or extra data (jsonb)
-- user_id: stores the tenant/owner ID for faster RLS and filtering
-- =================================================================

DO $$ 
BEGIN 
    -- 1. Add metadata column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'metadata') THEN
        ALTER TABLE public.messages ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- 2. Add user_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'user_id') THEN
        ALTER TABLE public.messages ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- Backfill user_id from conversations if possible
        UPDATE public.messages m
        SET user_id = c.user_id
        FROM public.conversations c
        WHERE m.conversation_id = c.id
        AND m.user_id IS NULL;
    END IF;
END $$;

-- 3. Notify PostgREST to refresh schema cache
NOTIFY pgrst, 'reload schema';
