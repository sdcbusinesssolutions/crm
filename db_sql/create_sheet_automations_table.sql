CREATE TABLE IF NOT EXISTS public.sheet_automations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    connection_id TEXT NOT NULL,
    spreadsheet_id TEXT NOT NULL,
    sheet_name TEXT NOT NULL,
    automation_type TEXT DEFAULT 'schedule',
    schedule_config JSONB DEFAULT '{}'::jsonb,
    trigger_condition JSONB DEFAULT '[]'::jsonb,
    template_config JSONB DEFAULT '{}'::jsonb,
    mapping_config JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'active',
    last_run_at TIMESTAMP WITH TIME ZONE,
    error_log TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- RLS Policies
ALTER TABLE public.sheet_automations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can view their own sheet automations" ON public.sheet_automations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can insert their own sheet automations" ON public.sheet_automations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can update their own sheet automations" ON public.sheet_automations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sheet automations" ON public.sheet_automations;
CREATE POLICY "Users can delete their own sheet automations" ON public.sheet_automations FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_sheet_automations_user_id ON public.sheet_automations(user_id);
