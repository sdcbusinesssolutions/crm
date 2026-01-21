-- ================================================================
-- FIX: Sheet Automations Schema & Cache
-- ================================================================
-- Run this script in your Supabase SQL Editor to resolve the 
-- "Could not find 'connection_id' column" error.

-- 1. Ensure Table Exists
CREATE TABLE IF NOT EXISTS public.sheet_automations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Columns Individually (Safe if they already exist)
DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN name TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'name column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN connection_id TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'connection_id column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN spreadsheet_id TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'spreadsheet_id column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN sheet_name TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'sheet_name column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN automation_type TEXT DEFAULT 'schedule';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'automation_type column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN schedule_config JSONB DEFAULT '{}'::jsonb;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'schedule_config column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN trigger_condition JSONB DEFAULT '[]'::jsonb;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'trigger_condition column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN template_config JSONB DEFAULT '{}'::jsonb;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'template_config column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN mapping_config JSONB DEFAULT '{}'::jsonb;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'mapping_config column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN status TEXT DEFAULT 'active';
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'status column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN last_run_at TIMESTAMP WITH TIME ZONE;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'last_run_at column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN error_log TEXT;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'error_log column already exists';
END $$;

DO $$
BEGIN
    ALTER TABLE public.sheet_automations ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'updated_at column already exists';
END $$;

-- 3. Security Policies (RLS)
ALTER TABLE public.sheet_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can view their own sheet automations" ON public.sheet_automations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can insert their own sheet automations" ON public.sheet_automations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can update their own sheet automations" ON public.sheet_automations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can delete their own sheet automations" ON public.sheet_automations FOR DELETE USING (auth.uid() = user_id);

-- 4. Reload Schema Cache (CRITICAL)
NOTIFY pgrst, 'reload config';
