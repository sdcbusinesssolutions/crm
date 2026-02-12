-- Add updated_at column to follow_ups table if it doesn't exist

DO $$
BEGIN
    -- Check for updated_at column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'follow_ups'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE follow_ups ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Check for created_at column (good practice)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'follow_ups'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE follow_ups ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
