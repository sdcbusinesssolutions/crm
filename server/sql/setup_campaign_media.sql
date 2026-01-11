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

-- =================================================================
-- 2. STORAGE BUCKET POLICIES (Required for "4 Policies" count)
-- =================================================================

-- Ensure campaign-media bucket exists (handled by script, but good for completeness in SQL)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign-media', 'campaign-media', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS for storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Public Read Access
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'campaign-media' );

-- Policy 2: Authenticated Insert (Upload)
CREATE POLICY "Authenticated Insert"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'campaign-media' AND auth.role() = 'authenticated' );

-- Policy 3: Owner Update
CREATE POLICY "Owner Update"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'campaign-media' AND auth.uid() = owner );

-- Policy 4: Owner Delete
CREATE POLICY "Owner Delete"
ON storage.objects FOR DELETE
USING ( bucket_id = 'campaign-media' AND auth.uid() = owner );

-- Output confirmation
SELECT 'Campaign Media Table and Storage Policies Configured Successfully' as status;
