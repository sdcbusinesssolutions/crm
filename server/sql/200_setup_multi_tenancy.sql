
-- =================================================================
-- ENABLE MULTI-TENANCY FOR AUTH USERS
-- Description: Adds a trigger to automatically sync the 'signup_domain'
-- from user_metadata into a queriable public.profiles table.
-- =================================================================

-- 1. Create a public profiles table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    signup_domain TEXT, -- The domain they registered on (e.g. 'chatmat.in')
    role TEXT DEFAULT 'user', -- 'admin', 'user', etc.
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies

-- Policy A: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = id);

-- Policy B: Service Role (Server) can do anything
CREATE POLICY "Service role full access" 
ON public.profiles FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Create a Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, signup_domain, role)
    VALUES (
        new.id, 
        new.email, 
        -- Extract domain from metadata, default to 'unknown' if missing
        COALESCE(new.raw_user_meta_data->>'signup_domain', 'unknown'),
        'user'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger the function every time a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Backfill existing users (Optional - Run if you have existing data)
-- This attempts to populate the profiles table for users who already exist
INSERT INTO public.profiles (id, email, signup_domain)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'signup_domain', 'legacy_user')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

