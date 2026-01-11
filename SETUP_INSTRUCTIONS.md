# ⚠️ Database Setup Required

The WhatsApp Management Module and Webhook System require new database tables and functions to operate correctly.

**You must run the following SQL scripts in your Supabase SQL Editor:**

## 1. WhatsApp Config & Security (Run First)

```sql
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

-- Policies
DROP POLICY IF EXISTS "Users can view their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can view their own whatsapp config" ON public.whatsapp_config FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can update their own whatsapp config" ON public.whatsapp_config FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own whatsapp config" ON public.whatsapp_config;
CREATE POLICY "Users can insert their own whatsapp config" ON public.whatsapp_config FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view their own security settings" ON public.user_security;
CREATE POLICY "Users can view their own security settings" ON public.user_security FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own security settings" ON public.user_security;
CREATE POLICY "Users can update their own security settings" ON public.user_security FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own security settings" ON public.user_security;
CREATE POLICY "Users can insert their own security settings" ON public.user_security FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 2. Webhook Logs & Functions (Run Second)

```sql
-- Webhook Logs Table
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  http_method TEXT NOT NULL,
  raw_payload JSONB,
  processed_status TEXT DEFAULT 'pending',
  message_type TEXT,
  sender_phone TEXT,
  extracted_content JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "Users can view their own webhook logs" ON public.webhook_logs;
CREATE POLICY "Users can view their own webhook logs" ON public.webhook_logs FOR SELECT USING (auth.uid() = user_id);

-- Function to Get Verify Token (Security Definer)
CREATE OR REPLACE FUNCTION public.get_verify_token(p_user_id UUID)
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
  WHERE user_id = p_user_id;
  
  RETURN v_token;
END;
$$;

-- Function to Log Webhook Event (Security Definer)
CREATE OR REPLACE FUNCTION public.log_webhook_event(
  p_user_id UUID,
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
  INSERT INTO public.webhook_logs (user_id, http_method, raw_payload, processed_status)
  VALUES (p_user_id, p_http_method, p_raw_payload, p_processed_status)
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to Update Webhook Log (Security Definer)
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
```
