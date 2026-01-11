
-- Create table for WhatsApp Flow Submissions
CREATE TABLE IF NOT EXISTS whatsapp_flow_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    flow_id TEXT NOT NULL,
    flow_name TEXT, 
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    submission_data JSONB NOT NULL,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE whatsapp_flow_submissions ENABLE ROW LEVEL SECURITY;

-- Policies (Drop first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view their own submissions" ON whatsapp_flow_submissions;
CREATE POLICY "Users can view their own submissions" 
ON whatsapp_flow_submissions FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert submissions" ON whatsapp_flow_submissions;
CREATE POLICY "System can insert submissions" 
ON whatsapp_flow_submissions FOR INSERT 
WITH CHECK (true);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_whatsapp_flow_submissions_flow_id ON whatsapp_flow_submissions(flow_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_flow_submissions_user_id ON whatsapp_flow_submissions(user_id);

-- Add UPDATE and DELETE policies
DROP POLICY IF EXISTS "Users can update their own submissions" ON whatsapp_flow_submissions;
CREATE POLICY "Users can update their own submissions" 
ON whatsapp_flow_submissions FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own submissions" ON whatsapp_flow_submissions;
CREATE POLICY "Users can delete their own submissions" 
ON whatsapp_flow_submissions FOR DELETE
USING (auth.uid() = user_id);
