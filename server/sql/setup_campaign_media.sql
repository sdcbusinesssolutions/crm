-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create campaign_media table to track uploaded media files
CREATE TABLE IF NOT EXISTS campaign_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    public_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE campaign_media ENABLE ROW LEVEL SECURITY;

-- Policies for campaign_media table
DROP POLICY IF EXISTS "Users can view their own campaign media" ON campaign_media;
CREATE POLICY "Users can view their own campaign media" 
ON campaign_media FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own campaign media" ON campaign_media;
CREATE POLICY "Users can insert their own campaign media" 
ON campaign_media FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own campaign media" ON campaign_media;
CREATE POLICY "Users can delete their own campaign media" 
ON campaign_media FOR DELETE 
USING (auth.uid() = user_id);

-- Create Index
CREATE INDEX IF NOT EXISTS idx_campaign_media_user_id ON campaign_media(user_id);

-- Note: The 'campaign-media' storage bucket should be created via the dashboard or script.
-- If you have the 'storage' extension enabled and permissions, you can try:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-media', 'campaign-media', true) ON CONFLICT DO NOTHING;

-- Storage Policies (if creating manually via SQL)
-- CREATE POLICY "Give users access to own folder 1ax3q2_0" ON storage.objects FOR SELECT TO public USING (bucket_id = 'campaign-media' AND auth.uid()::text = (storage.foldername(name))[1]);
-- (Adjust policies as needed for public access vs authenticated)
