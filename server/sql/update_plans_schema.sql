-- Create the plans table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.plans (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    name text NOT NULL,
    is_active boolean DEFAULT false,
    limits jsonb DEFAULT '{}'::jsonb,
    pricing jsonb DEFAULT '[]'::jsonb,
    ai_bot_enabled boolean DEFAULT false,
    api_access_enabled boolean DEFAULT false
);

-- Add columns if they are missing (safely)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'ai_bot_enabled') THEN
        ALTER TABLE public.plans ADD COLUMN ai_bot_enabled boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'api_access_enabled') THEN
        ALTER TABLE public.plans ADD COLUMN api_access_enabled boolean DEFAULT false;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'limits') THEN
        ALTER TABLE public.plans ADD COLUMN limits jsonb DEFAULT '{}'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'pricing') THEN
        ALTER TABLE public.plans ADD COLUMN pricing jsonb DEFAULT '[]'::jsonb;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'domain') THEN
        ALTER TABLE public.plans ADD COLUMN domain text DEFAULT 'clickube.com';
    END IF;
END $$;

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Idempotent Policy Creation for plans
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'plans' 
        AND policyname = 'Allow read access to authenticated users'
    ) THEN
        CREATE POLICY "Allow read access to authenticated users" ON public.plans
        FOR SELECT USING (auth.role() = 'authenticated');
    END IF;
END $$;

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    status text DEFAULT 'active',
    payment_term text,
    amount numeric,
    currency text DEFAULT 'INR'
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Idempotent Policy Creation for user_subscriptions
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'user_subscriptions' 
        AND policyname = 'Users can view own subscriptions'
    ) THEN
        CREATE POLICY "Users can view own subscriptions" ON public.user_subscriptions
        FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;
