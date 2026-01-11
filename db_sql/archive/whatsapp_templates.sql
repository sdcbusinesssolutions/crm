-- =====================================================
-- WHATSAPP TEMPLATES SCHEMA
-- =====================================================

CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  category TEXT NOT NULL,
  template_type TEXT NOT NULL, -- 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'
  header_format TEXT, -- 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION', 'NONE'
  header_text TEXT,
  header_media_handle TEXT,
  body_text TEXT NOT NULL,
  footer_text TEXT,
  buttons JSONB DEFAULT '[]'::jsonb, -- Store buttons structure
  status TEXT DEFAULT 'PENDING', -- 'APPROVED', 'REJECTED', 'PENDING', 'PAUSED', 'DISABLED'
  meta_template_id TEXT, -- ID from Meta
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view their own templates" ON public.whatsapp_templates;
CREATE POLICY "Users can view their own templates" ON public.whatsapp_templates FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own templates" ON public.whatsapp_templates;
CREATE POLICY "Users can insert their own templates" ON public.whatsapp_templates FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own templates" ON public.whatsapp_templates;
CREATE POLICY "Users can update their own templates" ON public.whatsapp_templates FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own templates" ON public.whatsapp_templates;
CREATE POLICY "Users can delete their own templates" ON public.whatsapp_templates FOR DELETE USING (auth.uid() = user_id);

-- Index
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_user_id ON public.whatsapp_templates(user_id);
