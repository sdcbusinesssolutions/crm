-- Fix tasks table schema - add updated_at column if missing

DO $$
BEGIN
    -- Check for updated_at column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column to tasks table';
    ELSE
        RAISE NOTICE 'updated_at column already exists in tasks table';
    END IF;

    -- Check for created_at column (good practice)
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'tasks'
        AND column_name = 'created_at'
    ) THEN
        ALTER TABLE tasks ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column to tasks table';
    ELSE
        RAISE NOTICE 'created_at column already exists in tasks table';
    END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
