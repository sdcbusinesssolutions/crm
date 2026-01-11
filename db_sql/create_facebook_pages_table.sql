CREATE TABLE IF NOT EXISTS public.integration_facebook_pages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    page_id VARCHAR(255) NOT NULL,
    page_name VARCHAR(255),
    page_access_token TEXT NOT NULL,
    is_connected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, page_id)
);

ALTER TABLE public.integration_facebook_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pages" ON public.integration_facebook_pages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pages" ON public.integration_facebook_pages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pages" ON public.integration_facebook_pages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pages" ON public.integration_facebook_pages
    FOR DELETE USING (auth.uid() = user_id);
