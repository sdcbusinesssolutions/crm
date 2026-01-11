-- =====================================================
-- COMPLETE DATABASE SCHEMA
-- Combines: Contacts, Pipelines, Forms, Leads, Notes, Tasks, Appointments, Call Logs
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. CORE TABLES (Contacts, Groups, Custom Fields)
-- =====================================================

-- Contacts Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  status TEXT,
  source TEXT,
  tags TEXT[] DEFAULT '{}',
  group_ids TEXT[] DEFAULT '{}',
  custom_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Contact Groups Table
CREATE TABLE IF NOT EXISTS public.contact_groups (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  description TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Custom Fields Table
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT,
  type TEXT,
  placeholder TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 2. PIPELINE & LEADS TABLES
-- =====================================================

-- Pipelines Table
CREATE TABLE IF NOT EXISTS public.pipelines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#3b82f6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pipeline Stages Table
CREATE TABLE IF NOT EXISTS public.pipeline_stages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#6b7280',
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Leads Table
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  name TEXT,
  email TEXT,
  phone TEXT,
  company TEXT,
  tags TEXT[] DEFAULT '{}',
  custom_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'active',
  priority TEXT DEFAULT 'medium',
  estimated_value DECIMAL(15, 2),
  source TEXT DEFAULT 'manual',
  type TEXT DEFAULT 'Lead', -- Added type column
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 3. FORMS & SUBMISSIONS TABLES
-- =====================================================

-- Forms Table
CREATE TABLE IF NOT EXISTS public.forms (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  form_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  fields JSONB DEFAULT '[]'::jsonb,
  pipeline_id UUID REFERENCES public.pipelines(id) ON DELETE SET NULL,
  stage_id UUID REFERENCES public.pipeline_stages(id) ON DELETE SET NULL,
  styling JSONB DEFAULT '{}'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  success_message TEXT DEFAULT 'Thank you for your submission!',
  success_redirect_url TEXT,
  default_group_ids TEXT[] DEFAULT '{}',
  default_tags TEXT[] DEFAULT '{}',
  default_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submission_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Form Submissions Table
CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  form_id UUID REFERENCES public.forms(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  submission_data JSONB NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- 4. LEAD RELATED TABLES (Notes, Tasks, Appointments, Call Logs)
-- =====================================================

-- Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  content TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Tasks (Follow-ups) Table
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  description TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, completed, canceled
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Call Logs Table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
    call_type TEXT CHECK (call_type IN ('inbound', 'outbound', 'missed')) DEFAULT 'outbound',
    duration INTEGER DEFAULT 0, -- in seconds
    notes TEXT,
    called_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. RLS POLICIES
-- =====================================================

-- Contacts Policies
DROP POLICY IF EXISTS "Users can view their own contacts" ON public.contacts;
CREATE POLICY "Users can view their own contacts" ON public.contacts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own contacts" ON public.contacts;
CREATE POLICY "Users can insert their own contacts" ON public.contacts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own contacts" ON public.contacts;
CREATE POLICY "Users can update their own contacts" ON public.contacts FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own contacts" ON public.contacts;
CREATE POLICY "Users can delete their own contacts" ON public.contacts FOR DELETE USING (auth.uid() = user_id);

-- Contact Groups Policies
DROP POLICY IF EXISTS "Users can view their own groups" ON public.contact_groups;
CREATE POLICY "Users can view their own groups" ON public.contact_groups FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own groups" ON public.contact_groups;
CREATE POLICY "Users can insert their own groups" ON public.contact_groups FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own groups" ON public.contact_groups;
CREATE POLICY "Users can update their own groups" ON public.contact_groups FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own groups" ON public.contact_groups;
CREATE POLICY "Users can delete their own groups" ON public.contact_groups FOR DELETE USING (auth.uid() = user_id);

-- Custom Fields Policies
DROP POLICY IF EXISTS "Users can view their own fields" ON public.custom_fields;
CREATE POLICY "Users can view their own fields" ON public.custom_fields FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own fields" ON public.custom_fields;
CREATE POLICY "Users can insert their own fields" ON public.custom_fields FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own fields" ON public.custom_fields;
CREATE POLICY "Users can update their own fields" ON public.custom_fields FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own fields" ON public.custom_fields;
CREATE POLICY "Users can delete their own fields" ON public.custom_fields FOR DELETE USING (auth.uid() = user_id);

-- Pipelines Policies
DROP POLICY IF EXISTS "Users can view their own pipelines" ON public.pipelines;
CREATE POLICY "Users can view their own pipelines" ON public.pipelines FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pipelines" ON public.pipelines;
CREATE POLICY "Users can insert their own pipelines" ON public.pipelines FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pipelines" ON public.pipelines;
CREATE POLICY "Users can update their own pipelines" ON public.pipelines FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pipelines" ON public.pipelines;
CREATE POLICY "Users can delete their own pipelines" ON public.pipelines FOR DELETE USING (auth.uid() = user_id);

-- Pipeline Stages Policies
DROP POLICY IF EXISTS "Users can view their own stages" ON public.pipeline_stages;
CREATE POLICY "Users can view their own stages" ON public.pipeline_stages FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own stages" ON public.pipeline_stages;
CREATE POLICY "Users can insert their own stages" ON public.pipeline_stages FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own stages" ON public.pipeline_stages;
CREATE POLICY "Users can update their own stages" ON public.pipeline_stages FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own stages" ON public.pipeline_stages;
CREATE POLICY "Users can delete their own stages" ON public.pipeline_stages FOR DELETE USING (auth.uid() = user_id);

-- Leads Policies
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
CREATE POLICY "Users can view their own leads" ON public.leads FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own leads" ON public.leads;
CREATE POLICY "Users can insert their own leads" ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
CREATE POLICY "Users can update their own leads" ON public.leads FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;
CREATE POLICY "Users can delete their own leads" ON public.leads FOR DELETE USING (auth.uid() = user_id);

-- Forms Policies
DROP POLICY IF EXISTS "Users can view their own forms" ON public.forms;
CREATE POLICY "Users can view their own forms" ON public.forms FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own forms" ON public.forms;
CREATE POLICY "Users can insert their own forms" ON public.forms FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own forms" ON public.forms;
CREATE POLICY "Users can update their own forms" ON public.forms FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own forms" ON public.forms;
CREATE POLICY "Users can delete their own forms" ON public.forms FOR DELETE USING (auth.uid() = user_id);

-- Public view active forms (for form rendering)
DROP POLICY IF EXISTS "Public view active forms" ON public.forms;
CREATE POLICY "Public view active forms" ON public.forms FOR SELECT USING (is_active = true);

-- Form Submissions Policies
DROP POLICY IF EXISTS "Anyone can submit forms" ON public.form_submissions;
CREATE POLICY "Anyone can submit forms" ON public.form_submissions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view their form submissions" ON public.form_submissions;
CREATE POLICY "Users can view their form submissions" ON public.form_submissions FOR SELECT USING (
  form_id IN (SELECT id FROM public.forms WHERE user_id = auth.uid())
);

-- Notes Policies
DROP POLICY IF EXISTS "Users can view their own notes" ON public.notes;
CREATE POLICY "Users can view their own notes" ON public.notes FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notes" ON public.notes;
CREATE POLICY "Users can insert their own notes" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notes" ON public.notes;
CREATE POLICY "Users can update their own notes" ON public.notes FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own notes" ON public.notes;
CREATE POLICY "Users can delete their own notes" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- Tasks Policies
DROP POLICY IF EXISTS "Users can view their own tasks" ON public.tasks;
CREATE POLICY "Users can view their own tasks" ON public.tasks FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own tasks" ON public.tasks;
CREATE POLICY "Users can insert their own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own tasks" ON public.tasks;
CREATE POLICY "Users can update their own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own tasks" ON public.tasks;
CREATE POLICY "Users can delete their own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);

-- Appointments Policies
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
CREATE POLICY "Users can view their own appointments" ON public.appointments FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own appointments" ON public.appointments;
CREATE POLICY "Users can insert their own appointments" ON public.appointments FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
CREATE POLICY "Users can update their own appointments" ON public.appointments FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;
CREATE POLICY "Users can delete their own appointments" ON public.appointments FOR DELETE USING (auth.uid() = user_id);

-- Call Logs Policies
DROP POLICY IF EXISTS "Users can view their own call logs" ON public.call_logs;
CREATE POLICY "Users can view their own call logs" ON public.call_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own call logs" ON public.call_logs;
CREATE POLICY "Users can insert their own call logs" ON public.call_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own call logs" ON public.call_logs;
CREATE POLICY "Users can update their own call logs" ON public.call_logs FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own call logs" ON public.call_logs;
CREATE POLICY "Users can delete their own call logs" ON public.call_logs FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- 7. INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pipelines_user_id ON public.pipelines(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_id ON public.pipeline_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_pipeline_id ON public.pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_user_id ON public.leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_id ON public.leads(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_leads_stage_id ON public.leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_forms_user_id ON public.forms(user_id);
CREATE INDEX IF NOT EXISTS idx_forms_token ON public.forms(form_token);
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id ON public.form_submissions(form_id);
CREATE INDEX IF NOT EXISTS idx_notes_lead_id ON public.notes(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_appointments_lead_id ON public.appointments(lead_id);
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id ON public.call_logs(lead_id);

-- =====================================================
-- 8. FUNCTIONS
-- =====================================================

-- Function to generate unique form token
CREATE OR REPLACE FUNCTION generate_form_token()
RETURNS TEXT AS $$
DECLARE
  v_token TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_token := encode(gen_random_bytes(6), 'base64');
    v_token := replace(replace(replace(v_token, '/', ''), '+', ''), '=', '');
    v_token := substring(v_token, 1, 8);
    
    SELECT EXISTS(SELECT 1 FROM public.forms WHERE form_token = v_token) INTO v_exists;
    
    IF NOT v_exists THEN
      RETURN v_token;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION generate_form_token TO authenticated;

-- Drop ALL potential existing functions with different signatures to avoid ambiguity
DROP FUNCTION IF EXISTS public.submit_form(TEXT, JSONB, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_form(TEXT, JSONB, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.submit_form(TEXT, JSONB);
DROP FUNCTION IF EXISTS public.submit_form(UUID, JSONB);
DROP FUNCTION IF EXISTS public.submit_form(UUID, JSONB, TEXT, TEXT);

-- Create secure submit_form function to bypass RLS for inserts
CREATE OR REPLACE FUNCTION public.submit_form(
    p_form_token TEXT,
    p_submission_data JSONB,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_form RECORD;
    v_contact_id UUID;
    v_lead_id UUID;
    v_submission_id UUID;
    v_name TEXT;
    v_email TEXT;
    v_phone TEXT;
    v_company TEXT;
    v_tags TEXT[];
    v_group_ids TEXT[];
BEGIN
    -- Get Form
    SELECT * INTO v_form
    FROM public.forms
    WHERE form_token = p_form_token AND is_active = true;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Form not found or inactive';
    END IF;

    -- Extract fields
    v_name := p_submission_data->>'name';
    v_email := p_submission_data->>'email';
    v_phone := p_submission_data->>'phone';
    v_company := p_submission_data->>'company';

    -- Extract tags and groups from settings
    -- Use COALESCE to handle nulls and ensure array type
    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_tags') = 'array' 
                THEN v_form.settings->'default_tags' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_tags;

    SELECT ARRAY(
        SELECT jsonb_array_elements_text(
            CASE 
                WHEN jsonb_typeof(v_form.settings->'default_group_ids') = 'array' 
                THEN v_form.settings->'default_group_ids' 
                ELSE '[]'::jsonb 
            END
        )
    ) INTO v_group_ids;

    -- Create Contact
    INSERT INTO public.contacts (
        user_id, name, email, phone, status, source, tags, group_ids, custom_data
    ) VALUES (
        v_form.user_id,
        COALESCE(v_name, 'Unknown'),
        v_email,
        v_phone,
        'New',
        'Web Form',
        v_tags,
        v_group_ids,
        p_submission_data
    ) RETURNING id INTO v_contact_id;

    -- Create Lead
    IF v_form.pipeline_id IS NOT NULL THEN
        INSERT INTO public.leads (
            user_id, pipeline_id, stage_id, name, email, phone, company, custom_data, source, status
        ) VALUES (
            v_form.user_id,
            v_form.pipeline_id,
            v_form.stage_id,
            COALESCE(v_name, 'Unknown'),
            v_email,
            v_phone,
            v_company,
            p_submission_data,
            'web_form',
            'active'
        ) RETURNING id INTO v_lead_id;
    END IF;

    -- Create Submission
    INSERT INTO public.form_submissions (
        form_id, lead_id, submission_data, ip_address, user_agent
    ) VALUES (
        v_form.id,
        v_lead_id,
        p_submission_data,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO v_submission_id;

    -- Update Count
    UPDATE public.forms
    SET submission_count = submission_count + 1
    WHERE id = v_form.id;

    RETURN jsonb_build_object(
        'success', true,
        'submission_id', v_submission_id,
        'lead_id', v_lead_id,
        'contact_id', v_contact_id,
        'message', v_form.success_message
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_form(TEXT, JSONB, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_form(TEXT, JSONB, TEXT, TEXT) TO authenticated;
-- =====================================================
-- WHATSAPP MANAGEMENT MODULE SCHEMA
-- =====================================================

-- WhatsApp Configuration Table
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone_number TEXT,
  phone_number_id TEXT,
  whatsapp_business_account_id TEXT,
  meta_app_id TEXT,
  meta_access_token TEXT,
  verify_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- User Security Table (for 2FA)
CREATE TABLE IF NOT EXISTS public.user_security (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  two_factor_secret TEXT,
  two_factor_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security ENABLE ROW LEVEL SECURITY;

-- Policies for whatsapp_config
DROP POLICY IF EXISTS "Users can view their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for user_security
DROP POLICY IF EXISTS "Users can view their own security settings" ON public.user_security;
CREATE POLICY "Users can view their own security settings" ON public.user_security FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own security settings" ON public.user_security;
CREATE POLICY "Users can update their own security settings" ON public.user_security FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own security settings" ON public.user_security;
CREATE POLICY "Users can insert their own security settings" ON public.user_security FOR INSERT WITH CHECK (auth.uid() = user_id);
-- =====================================================
-- EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- CONVERSATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  last_message TEXT,
  unread_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open', -- 'open', 'resolved', 'pending'
  tags TEXT[] DEFAULT '{}',
  assigned_to UUID REFERENCES auth.users(id), -- For multi-agent support later
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, contact_phone)
);

-- =====================================================
-- MESSAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'text', 'image', 'video', 'document', 'audio', 'sticker', 'location', 'button_reply'
  text TEXT,
  media_url TEXT,
  filename TEXT,
  mime_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  direction TEXT CHECK (direction IN ('in', 'out')),
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Conversations
DROP POLICY IF EXISTS "Users can view their own conversations" ON public.conversations;
CREATE POLICY "Users can view their own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own conversations" ON public.conversations;
CREATE POLICY "Users can insert their own conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own conversations" ON public.conversations;
CREATE POLICY "Users can update their own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own conversations" ON public.conversations;
CREATE POLICY "Users can delete their own conversations" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- Messages
-- Users can access messages if they own the conversation
DROP POLICY IF EXISTS "Users can view messages of their conversations" ON public.messages;
CREATE POLICY "Users can view messages of their conversations" ON public.messages FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert messages into their conversations" ON public.messages;
CREATE POLICY "Users can insert messages into their conversations" ON public.messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
  )
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
-- =====================================================
-- BRANDING SETTINGS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.branding_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own branding" ON public.branding_settings;
CREATE POLICY "Users can view their own branding" ON public.branding_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own branding" ON public.branding_settings;
CREATE POLICY "Users can insert their own branding" ON public.branding_settings FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own branding" ON public.branding_settings;
CREATE POLICY "Users can update their own branding" ON public.branding_settings FOR UPDATE USING (auth.uid() = user_id);
-- =====================================================
-- FLOWS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS public.flows (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled Flow',
  description TEXT DEFAULT 'No description',
  status TEXT DEFAULT 'Draft', -- 'Draft' or 'Published'
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- =====================================================
-- ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own flows" ON public.flows;
CREATE POLICY "Users can view their own flows" ON public.flows FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own flows" ON public.flows;
CREATE POLICY "Users can insert their own flows" ON public.flows FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own flows" ON public.flows;
CREATE POLICY "Users can update their own flows" ON public.flows FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own flows" ON public.flows;
CREATE POLICY "Users can delete their own flows" ON public.flows FOR DELETE USING (auth.uid() = user_id);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_flows_user_id ON public.flows(user_id);
-- =====================================================
-- COMBINED WEBHOOK & WHATSAPP SCHEMA (v5)
-- =====================================================

-- 1. Webhook Logs Table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number_id TEXT, -- Added to track which account received the event
  http_method TEXT NOT NULL,
  raw_payload JSONB,
  processed_status TEXT DEFAULT 'pending', -- pending, processed, failed
  message_type TEXT,
  sender_phone TEXT,
  extracted_content JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure all columns exist (idempotent)
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS message_type TEXT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS raw_payload JSONB;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS extracted_content JSONB;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS phone_number_id TEXT;

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own logs
DROP POLICY IF EXISTS "Users can view their own webhook logs" ON public.webhook_logs;
CREATE POLICY "Users can view their own webhook logs" ON public.webhook_logs FOR SELECT USING (auth.uid() = user_id);

-- 2. Update whatsapp_config to allow multiple accounts
-- Remove the unique constraint on user_id to allow multiple accounts per user
ALTER TABLE public.whatsapp_config DROP CONSTRAINT IF EXISTS whatsapp_config_user_id_key;

-- Add a name column to distinguish accounts
ALTER TABLE public.whatsapp_config ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'WhatsApp Account';

-- IMPORTANT: Add DELETE Policy for whatsapp_config (Fixes delete issue)
DROP POLICY IF EXISTS "Users can delete their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can delete their own whatsapp config" ON public.whatsapp_config FOR DELETE USING (auth.uid() = user_id);

-- Ensure other policies exist (idempotent)
DROP POLICY IF EXISTS "Users can view their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 3. Function to Get Verify Token (Bypassing RLS for Webhook Verification)
-- UPDATED: Now requires phone_number_id to verify specific account
DROP FUNCTION IF EXISTS public.get_verify_token(UUID); -- Drop old signature if exists
CREATE OR REPLACE FUNCTION public.get_verify_token(p_user_id UUID, p_phone_number_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
BEGIN
  SELECT verify_token INTO v_token
  FROM public.whatsapp_config
  WHERE user_id = p_user_id AND phone_number_id = p_phone_number_id
  LIMIT 1;
  
  RETURN v_token;
END;
$$;

-- 4. Function to Log Webhook Event (Bypassing RLS)
-- UPDATED: Now accepts phone_number_id
DROP FUNCTION IF EXISTS public.log_webhook_event(UUID, TEXT, JSONB, TEXT); -- Drop old signature
CREATE OR REPLACE FUNCTION public.log_webhook_event(
  p_user_id UUID,
  p_phone_number_id TEXT,
  p_http_method TEXT,
  p_raw_payload JSONB,
  p_processed_status TEXT DEFAULT 'pending'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.webhook_logs (user_id, phone_number_id, http_method, raw_payload, processed_status)
  VALUES (p_user_id, p_phone_number_id, p_http_method, p_raw_payload, p_processed_status)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- 5. Function to Update Webhook Log (Bypassing RLS)
CREATE OR REPLACE FUNCTION public.update_webhook_log(
  p_log_id UUID,
  p_processed_status TEXT,
  p_message_type TEXT DEFAULT NULL,
  p_sender_phone TEXT DEFAULT NULL,
  p_extracted_content JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.webhook_logs
  SET 
    processed_status = p_processed_status,
    message_type = p_message_type,
    sender_phone = p_sender_phone,
    extracted_content = p_extracted_content,
    error_message = p_error_message,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_log_id;
END;
$$;
-- =====================================================
-- HANDLE INBOUND MESSAGE FUNCTION
-- =====================================================
-- This function handles the logic for processing an incoming WhatsApp message.
-- It bypasses RLS to allow the webhook (unauthenticated) to insert data for a specific user.
-- It automatically finds or creates the conversation and inserts the message.

CREATE OR REPLACE FUNCTION public.handle_inbound_message(
    p_user_id UUID,
    p_contact_phone TEXT,
    p_contact_name TEXT,
    p_message_type TEXT,
    p_message_text TEXT DEFAULT NULL,
    p_media_url TEXT DEFAULT NULL,
    p_filename TEXT DEFAULT NULL,
    p_mime_type TEXT DEFAULT NULL,
    p_latitude DOUBLE PRECISION DEFAULT NULL,
    p_longitude DOUBLE PRECISION DEFAULT NULL,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS
SET search_path = public
AS $$
DECLARE
    v_conversation_id UUID;
    v_conversation_unread_count INTEGER;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id, unread_count INTO v_conversation_id, v_conversation_unread_count
    FROM public.conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO public.conversations (
            user_id,
            contact_phone,
            contact_name,
            last_message,
            unread_count,
            status,
            updated_at
        ) VALUES (
            p_user_id,
            p_contact_phone,
            p_contact_name,
            COALESCE(p_message_text, '[' || p_message_type || ']'),
            1,
            'open',
            NOW()
        ) RETURNING id INTO v_conversation_id;
    ELSE
        UPDATE public.conversations
        SET last_message = COALESCE(p_message_text, '[' || p_message_type || ']'),
            unread_count = COALESCE(v_conversation_unread_count, 0) + 1,
            updated_at = NOW()
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO public.messages (
        conversation_id,
        type,
        text,
        media_url,
        filename,
        mime_type,
        latitude,
        longitude,
        direction,
        status,
        created_at
    ) VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        p_filename,
        p_mime_type,
        p_latitude,
        p_longitude,
        'in',
        'delivered',
        p_timestamp
    ) RETURNING id INTO v_message_id;

    RETURN jsonb_build_object(
        'conversation_id', v_conversation_id,
        'message_id', v_message_id
    );
END;
$$;
CREATE OR REPLACE FUNCTION public.get_whatsapp_config(
    p_user_id UUID,
    p_phone_number_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Bypasses RLS
SET search_path = public
AS $$
DECLARE
    v_config JSONB;
BEGIN
    IF p_phone_number_id IS NOT NULL THEN
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        AND wc.phone_number_id = p_phone_number_id
        LIMIT 1;
    ELSE
        -- If no phone number ID provided, return the first one found for the user
        SELECT to_jsonb(wc)
        INTO v_config
        FROM public.whatsapp_config wc
        WHERE wc.user_id = p_user_id
        LIMIT 1;
    END IF;

    RETURN v_config;
END;
$$;
-- ============================================================
-- WHATSAPP FLOW ENGINE - COMPLETE & CONSOLIDATED SETUP
-- ============================================================
-- PURPOSE:
-- This single file contains the entire database schema, logic, and security settings
-- required to run the WhatsApp Flow Engine. It is designed to be idempotent (safe to run multiple times).

-- MODULES INCLUDED:
-- 1. FLOW OPTIMIZATION: Adds a dedicated column for keywords to make lookups fast and case-insensitive.
-- 2. SESSION MANAGEMENT: Creates a table to track where a user is in a flow (state machine).
-- 3. AUTOMATION TRIGGERS: Automatically extracts keywords from the visual flow builder JSON.
-- 4. SECURITY (RLS): Ensures users can only access their own data.
-- 5. BACKEND API (RPC): Secure functions for the Node.js server to interact with the DB.

-- ============================================================
-- MODULE 1: FLOW OPTIMIZATION (Keywords)
-- ============================================================
-- WHY: Searching inside a large JSONB column (the flow structure) is slow and complex.
-- SOLUTION: We extract keywords into a dedicated text array column (`trigger_keywords`) for instant lookups.

-- 1. Add column to store extracted keywords
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS trigger_keywords TEXT[] DEFAULT '{}';

-- 2. Create Index for fast array searching
CREATE INDEX IF NOT EXISTS idx_flows_keywords 
ON flows USING GIN(trigger_keywords);


-- ============================================================
-- MODULE 2: AUTOMATION TRIGGERS (Auto-Extract Keywords)
-- ============================================================
-- WHY: We don't want to manually update the `trigger_keywords` column every time the flow JSON changes.
-- SOLUTION: A database trigger automatically parses the JSON, finds 'onMessage' nodes, lowercases the keywords, and saves them.

CREATE OR REPLACE FUNCTION update_flow_keywords()
RETURNS TRIGGER AS $$
DECLARE
    keywords text[];
BEGIN
    -- Logic:
    -- 1. Parse the 'nodes' JSON array.
    -- 2. Find nodes where type is 'onMessage'.
    -- 3. Extract the 'keywords' array from those nodes.
    -- 4. Convert all keywords to LOWERCASE for case-insensitive matching.
    SELECT ARRAY_AGG(DISTINCT LOWER(k))
    INTO keywords
    FROM jsonb_array_elements(NEW.nodes) AS n(data),
         jsonb_array_elements_text(n.data->'data'->'keywords') AS k
    WHERE n.data->>'type' = 'onMessage';

    -- Update the dedicated column
    NEW.trigger_keywords := COALESCE(keywords, '{}');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the 'flows' table
DROP TRIGGER IF EXISTS trg_update_flow_keywords ON flows;
CREATE TRIGGER trg_update_flow_keywords
BEFORE INSERT OR UPDATE ON flows
FOR EACH ROW
EXECUTE FUNCTION update_flow_keywords();

-- MAINTENANCE: Force update all existing flows to ensure keywords are populated and lowercased immediately
UPDATE flows SET updated_at = NOW();


-- ============================================================
-- MODULE 3: SESSION MANAGEMENT (State Tracking)
-- ============================================================
-- WHY: WhatsApp is stateless. We need to remember "User X is at Step Y of Flow Z" to handle multi-step conversations.
-- SOLUTION: The `flow_sessions` table acts as the memory for the bot.

CREATE TABLE IF NOT EXISTS flow_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- The business owner
    contact_phone TEXT NOT NULL,                              -- The end user (customer)
    flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,      -- Which flow they are in
    current_node_id TEXT,                                     -- Current step ID
    status TEXT DEFAULT 'active',                             -- Status: 'active', 'completed', 'waiting_input', 'error', 'aborted'
    variables JSONB DEFAULT '{}',                             -- Context data (collected answers)
    last_interaction_at TIMESTAMPTZ DEFAULT NOW(),            -- For timeout logic
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-performance lookups during message processing
CREATE INDEX IF NOT EXISTS idx_flow_sessions_active 
ON flow_sessions(contact_phone, status) 
WHERE status = 'active' OR status = 'waiting_input';


-- ============================================================
-- MODULE 4: SECURITY (Row Level Security)
-- ============================================================
-- WHY: Prevent one user from seeing another user's flow sessions.
-- SOLUTION: RLS policies that restrict access based on the authenticated `user_id`.

ALTER TABLE flow_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: View Own Sessions
DROP POLICY IF EXISTS "Users can view their own flow sessions" ON flow_sessions;
CREATE POLICY "Users can view their own flow sessions"
ON flow_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Insert Own Sessions
DROP POLICY IF EXISTS "Users can insert their own flow sessions" ON flow_sessions;
CREATE POLICY "Users can insert their own flow sessions"
ON flow_sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Update Own Sessions
DROP POLICY IF EXISTS "Users can update their own flow sessions" ON flow_sessions;
CREATE POLICY "Users can update their own flow sessions"
ON flow_sessions FOR UPDATE
USING (auth.uid() = user_id);


-- ============================================================
-- MODULE 5: BACKEND API (Secure RPC Functions)
-- ============================================================
-- WHY: The Node.js server (Webhook) runs without a user session context. It needs "Root" access to specific tables.
-- SOLUTION: `SECURITY DEFINER` functions allow the server to bypass RLS safely for specific operations.

-- 5.1 Get Active Session
-- Finds if a specific phone number is currently in a flow.
CREATE OR REPLACE FUNCTION get_active_session(p_contact_phone TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    contact_phone TEXT,
    flow_id UUID,
    current_node_id TEXT,
    status TEXT,
    variables JSONB,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT fs.id, fs.user_id, fs.contact_phone, fs.flow_id, fs.current_node_id, fs.status, fs.variables, fs.created_at, fs.last_interaction_at
    FROM flow_sessions fs
    WHERE fs.contact_phone = p_contact_phone
      AND fs.status = 'waiting_input'
    ORDER BY fs.created_at DESC
    LIMIT 1;
END;
$$;

-- 5.2 Cancel Active Sessions
-- Prevents "Ghost Sessions" by aborting old flows before starting a new one.
CREATE OR REPLACE FUNCTION cancel_active_sessions(p_contact_phone TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE flow_sessions
    SET status = 'aborted',
        last_interaction_at = NOW()
    WHERE contact_phone = p_contact_phone
      AND (status = 'active' OR status = 'waiting_input');
END;
$$;

-- 5.3 Create New Session
-- Starts a new flow for a user.
CREATE OR REPLACE FUNCTION create_flow_session(
    p_user_id UUID,
    p_contact_phone TEXT,
    p_flow_id UUID,
    p_current_node_id TEXT,
    p_variables JSONB
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_result JSONB;
    v_id UUID;
BEGIN
    INSERT INTO flow_sessions (user_id, contact_phone, flow_id, current_node_id, status, variables)
    VALUES (p_user_id, p_contact_phone, p_flow_id, p_current_node_id, 'active', p_variables)
    RETURNING id INTO v_id;

    SELECT to_jsonb(fs.*) INTO v_result FROM flow_sessions fs WHERE id = v_id;
    RETURN v_result;
END;
$$;

-- 5.4 Update Session Variables
-- Saves user inputs (answers) into the session context.
CREATE OR REPLACE FUNCTION update_session_variables(
    p_session_id UUID,
    p_variables JSONB
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE flow_sessions
    SET variables = p_variables,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;

-- 5.5 Update Session Step
-- Moves the user to the next node in the flow.
CREATE OR REPLACE FUNCTION update_session_step(
    p_session_id UUID,
    p_current_node_id TEXT,
    p_status TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE flow_sessions
    SET current_node_id = p_current_node_id,
        status = p_status,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;

-- 5.6 Update Session Status
-- Marks a flow as 'completed' or 'error'.
CREATE OR REPLACE FUNCTION update_session_status(
    p_session_id UUID,
    p_status TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE flow_sessions
    SET status = p_status,
        last_interaction_at = NOW()
    WHERE id = p_session_id;
END;
$$;

-- 5.7 Get Flow By ID
-- Fetches flow definition for execution (Bypasses RLS).
CREATE OR REPLACE FUNCTION get_flow_by_id(p_flow_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    nodes JSONB,
    edges JSONB,
    status TEXT,
    trigger_keywords TEXT[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.id = p_flow_id;
END;
$$;

-- 5.8 Get Flow By Keyword
-- Finds a flow that matches an incoming message keyword.
-- UPDATED: Uses array containment operator @> for fast index lookup.
CREATE OR REPLACE FUNCTION get_flow_by_keyword(p_keyword TEXT, p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    nodes JSONB,
    edges JSONB,
    status TEXT,
    trigger_keywords TEXT[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.user_id = p_user_id
      AND f.status = 'Published'
      AND f.trigger_keywords @> ARRAY[LOWER(p_keyword)]; -- Ensure input is also lowercased for safety
END;
$$;
-- Add webhook_id to webhook_logs to track specific flow nodes
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS webhook_id TEXT;
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
-- ============================================================
-- FIX: Flow Keywords & Triggering
-- ============================================================

-- 1. Ensure the keywords column exists
ALTER TABLE flows 
ADD COLUMN IF NOT EXISTS trigger_keywords TEXT[] DEFAULT '{}';

-- 2. Create Index for fast searching
CREATE INDEX IF NOT EXISTS idx_flows_keywords 
ON flows USING GIN(trigger_keywords);

-- 3. Update the Trigger Function (Ensure it handles case correctly)
CREATE OR REPLACE FUNCTION update_flow_keywords()
RETURNS TRIGGER AS $$
DECLARE
    keywords text[];
BEGIN
    -- Extract 'keywords' from 'onMessage' nodes
    SELECT ARRAY_AGG(DISTINCT LOWER(k))
    INTO keywords
    FROM jsonb_array_elements(NEW.nodes) AS n(data),
         jsonb_array_elements_text(n.data->'data'->'keywords') AS k
    WHERE n.data->>'type' = 'onMessage';

    -- Update the dedicated column
    NEW.trigger_keywords := COALESCE(keywords, '{}');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Re-attach Trigger
DROP TRIGGER IF EXISTS trg_update_flow_keywords ON flows;
CREATE TRIGGER trg_update_flow_keywords
BEFORE INSERT OR UPDATE ON flows
FOR EACH ROW
EXECUTE FUNCTION update_flow_keywords();

-- 5. FORCE UPDATE all flows to populate the keywords column
UPDATE flows SET updated_at = NOW();

-- 6. Update the Search Function (Case-Insensitive Status)
CREATE OR REPLACE FUNCTION get_flow_by_keyword(p_keyword TEXT, p_user_id UUID)
RETURNS TABLE (
    id UUID,
    name TEXT,
    nodes JSONB,
    edges JSONB,
    status TEXT,
    trigger_keywords TEXT[]
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.name, f.nodes, f.edges, f.status, f.trigger_keywords
    FROM flows f
    WHERE f.user_id = p_user_id
      -- Check status case-insensitively (Published, published, PUBLISHED)
      AND LOWER(f.status) = 'published'
      -- Check keyword containment
      AND f.trigger_keywords @> ARRAY[LOWER(p_keyword)];
END;
$$;
-- Function to log outbound messages (Bot -> User)
CREATE OR REPLACE FUNCTION log_outbound_message(
    p_user_id UUID,
    p_contact_phone TEXT,
    p_message_type TEXT,
    p_message_text TEXT DEFAULT NULL,
    p_media_url TEXT DEFAULT NULL,
    p_status TEXT DEFAULT 'sent',
    p_whatsapp_message_id TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_conversation_id UUID;
    v_message_id UUID;
BEGIN
    -- 1. Find or Create Conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE user_id = p_user_id AND contact_phone = p_contact_phone;

    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (user_id, contact_phone, status, unread_count, last_message, updated_at)
        VALUES (p_user_id, p_contact_phone, 'open', 0, 'Outbound Message', NOW())
        RETURNING id INTO v_conversation_id;
    ELSE
        -- Update conversation timestamp
        UPDATE conversations
        SET updated_at = NOW(),
            last_message = COALESCE(p_message_text, 'Sent ' || p_message_type)
        WHERE id = v_conversation_id;
    END IF;

    -- 2. Insert Message
    INSERT INTO messages (
        conversation_id,
        type,
        text,
        media_url,
        direction,
        status,
        whatsapp_message_id,
        created_at
    )
    VALUES (
        v_conversation_id,
        p_message_type,
        p_message_text,
        p_media_url,
        'out',
        p_status,
        p_whatsapp_message_id,
        NOW()
    )
    RETURNING id INTO v_message_id;

    RETURN v_message_id;
END;
$$;
-- ==========================================
-- Message Status & Read Receipts Logic (FIXED)
-- ==========================================

-- 1. Add columns individually using IF NOT EXISTS (Postgres 9.6+)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS whatsapp_message_id TEXT;

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Create Index
CREATE INDEX IF NOT EXISTS idx_messages_whatsapp_message_id ON public.messages(whatsapp_message_id);

-- 3. Function to update message status
CREATE OR REPLACE FUNCTION public.update_message_status(
    p_whatsapp_message_id TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Ensure the column exists before trying to update it (Just in case, though ALTER above should handle it)
    -- But we can't do DDL inside a function easily.
    -- We assume the ALTER statements above ran successfully.

    UPDATE public.messages
    SET status = p_status,
        updated_at = NOW()
    WHERE whatsapp_message_id = p_whatsapp_message_id;

    RETURN FOUND;
END;
$$;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION public.update_message_status(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.update_message_status(TEXT, TEXT) TO authenticated;
-- ============================================================
-- RPC: Find Flow by Webhook ID
-- ============================================================
-- PURPOSE: Allow the backend to find a flow containing a specific webhook ID
-- without needing the Service Role Key (bypassing RLS).

CREATE OR REPLACE FUNCTION find_flow_by_webhook_id(p_webhook_id TEXT)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name TEXT,
    nodes JSONB,
    edges JSONB,
    status TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT f.id, f.user_id, f.name, f.nodes, f.edges, f.status
    FROM flows f
    WHERE f.nodes @> ('[{"data": {"webhookId": "' || p_webhook_id || '"}}]')::jsonb;
END;
$$;
-- 1. Drop ALL existing versions of log_webhook_event to resolve ambiguity
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT oid::regprocedure AS func_signature
             FROM pg_proc
             WHERE proname = 'log_webhook_event'
             AND pronamespace = 'public'::regnamespace
    LOOP
        EXECUTE 'DROP FUNCTION ' || r.func_signature;
    END LOOP;
END $$;

-- 2. Re-create the function with the correct signature
-- 2. Re-create the function with the correct signature (MATCHING webhook.js)
CREATE OR REPLACE FUNCTION public.log_webhook_event(
    p_user_id UUID,
    p_phone_number_id TEXT,
    p_http_method TEXT,
    p_raw_payload JSONB,
    p_processed_status TEXT DEFAULT 'pending',
    p_message_type TEXT DEFAULT NULL,
    p_sender_phone TEXT DEFAULT NULL,
    p_webhook_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
    INSERT INTO public.webhook_logs (
        user_id,
        phone_number_id,
        http_method,
        raw_payload,
        processed_status,
        message_type,
        sender_phone,
        webhook_id,
        created_at
    ) VALUES (
        p_user_id,
        p_phone_number_id,
        p_http_method,
        p_raw_payload,
        p_processed_status,
        p_message_type,
        p_sender_phone,
        p_webhook_id,
        NOW()
    ) RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_webhook_event TO anon;
GRANT EXECUTE ON FUNCTION public.log_webhook_event TO authenticated;

-- 3. Ensure get_latest_webhook_log is also correct
CREATE OR REPLACE FUNCTION public.get_latest_webhook_log(p_webhook_id TEXT)
RETURNS TABLE (raw_payload JSONB, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT wl.raw_payload, wl.created_at
    FROM public.webhook_logs wl
    WHERE wl.webhook_id = p_webhook_id
    ORDER BY wl.created_at DESC
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_latest_webhook_log TO anon;
GRANT EXECUTE ON FUNCTION public.get_latest_webhook_log TO authenticated;
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
-- Campaigns Table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    template_id UUID REFERENCES whatsapp_templates(id),
    template_name TEXT,
    language_code TEXT,
    contact_group_id UUID,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    variable_mapping JSONB, -- Stores mapping for template variables
    status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, PROCESSING, COMPLETED, PAUSED, FAILED
    total_contacts INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign Queue Table
CREATE TABLE IF NOT EXISTS campaign_queue (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id),
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING', -- PENDING, SENT, FAILED, INVALID
    message_id TEXT,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Meta Limits Table
CREATE TABLE IF NOT EXISTS meta_limits (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    waba_id TEXT NOT NULL,
    tier TEXT,
    daily_limit INTEGER,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, waba_id)
);

-- RLS Policies
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
CREATE POLICY "Users can view their own campaigns" ON campaigns FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
CREATE POLICY "Users can insert their own campaigns" ON campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
CREATE POLICY "Users can update their own campaigns" ON campaigns FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;
CREATE POLICY "Users can delete their own campaigns" ON campaigns FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own campaign queue" ON campaign_queue;
CREATE POLICY "Users can view their own campaign queue" ON campaign_queue FOR SELECT USING (EXISTS (SELECT 1 FROM campaigns WHERE campaigns.id = campaign_queue.campaign_id AND campaigns.user_id = auth.uid()));

ALTER TABLE meta_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own limits" ON meta_limits;
CREATE POLICY "Users can view their own limits" ON meta_limits FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own limits" ON meta_limits;
CREATE POLICY "Users can insert their own limits" ON meta_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own limits" ON meta_limits;
CREATE POLICY "Users can update their own limits" ON meta_limits FOR UPDATE USING (auth.uid() = user_id);

-- RPC Functions for Counters
CREATE OR REPLACE FUNCTION increment_campaign_success(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET success_count = success_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_campaign_failed(row_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET failed_count = failed_count + 1
  WHERE id = row_id;
END;
$$ LANGUAGE plpgsql;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS location_header JSONB DEFAULT '{}'::jsonb;
-- Consolidated RLS Fixes for Campaign System (Single File)

-- 1. Enable RLS on tables (idempotent)
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_queue ENABLE ROW LEVEL SECURITY;

-- 2. Clean up existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can insert their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can update their own campaigns" ON campaigns;
DROP POLICY IF EXISTS "Users can delete their own campaigns" ON campaigns;

DROP POLICY IF EXISTS "Users can view their own campaign_queue items" ON campaign_queue;
DROP POLICY IF EXISTS "Users can insert into campaign_queue for their campaigns" ON campaign_queue;
DROP POLICY IF EXISTS "Users can update their own campaign_queue items" ON campaign_queue;

-- 3. Campaigns Policies
CREATE POLICY "Users can view their own campaigns"
ON campaigns FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own campaigns"
ON campaigns FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns"
ON campaigns FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns"
ON campaigns FOR DELETE
USING (auth.uid() = user_id);

-- 4. Campaign Queue Policies
CREATE POLICY "Users can view their own campaign_queue items"
ON campaign_queue FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert into campaign_queue for their campaigns"
ON campaign_queue FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their own campaign_queue items"
ON campaign_queue FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM campaigns
    WHERE campaigns.id = campaign_queue.campaign_id
    AND campaigns.user_id = auth.uid()
  )
);

-- 5. Grant permissions (Fixed: Removed sequence grants if they don't exist)
GRANT ALL ON campaigns TO authenticated;
GRANT ALL ON campaign_queue TO authenticated;
-- Only grant on sequences if they exist (Postgres doesn't support IF EXISTS for GRANT easily, so we skip explicit sequence grants)
-- Usually, granting ALL on the table is enough for serial columns if the user owns the table or if defaults are handled by the system.
-- If explicit sequence access is needed, it depends on the exact sequence name which might differ.
-- We will rely on the table grants.
CREATE OR REPLACE FUNCTION public.update_message_status(
    p_whatsapp_message_id TEXT,
    p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update Messages Table (Chat History)
    UPDATE public.messages
    SET status = p_status,
        updated_at = NOW()
    WHERE whatsapp_message_id = p_whatsapp_message_id;

    -- 2. Update Campaign Queue (Campaign Stats)
    -- Only updates if the message ID exists in the queue (i.e. it was sent via campaign)
    UPDATE public.campaign_queue
    SET status = UPPER(p_status), -- Campaign queue uses uppercase (SENT, DELIVERED, READ)
        updated_at = NOW()
    WHERE message_id = p_whatsapp_message_id;

    RETURN FOUND;
END;
$$;
