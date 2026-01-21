-- Create a table to track individual message history for sheet automations
-- This enables "Once per day" or "Once per row" deduplication logic.

CREATE TABLE IF NOT EXISTS public.sheet_automation_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    automation_id UUID REFERENCES public.sheet_automations(id) ON DELETE CASCADE,
    row_hash TEXT NOT NULL,
    phone_number TEXT,
    status TEXT DEFAULT 'sent',
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Index for fast lookups during execution loop
CREATE INDEX IF NOT EXISTS idx_sheet_history_lookup 
ON public.sheet_automation_history (automation_id, row_hash);

-- Index for cleanup/policies
CREATE INDEX IF NOT EXISTS idx_sheet_history_sent_at 
ON public.sheet_automation_history (sent_at);

-- RLS
ALTER TABLE public.sheet_automation_history ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own automation history
-- (Indirectly via automation_id ownership, which might need a join or simpler check)
-- Ideally, the service role (backend) does the insertion/checking, so RLS might not block it if using service key.
-- But for frontend visibility:

CREATE POLICY "Users can view history of their automations" 
ON public.sheet_automation_history FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.sheet_automations a 
        WHERE a.id = sheet_automation_history.automation_id 
        AND a.user_id = auth.uid()
    )
);
