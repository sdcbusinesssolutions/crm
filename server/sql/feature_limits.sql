CREATE TABLE IF NOT EXISTS public.feature_limits (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    feature_name VARCHAR(255) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('USER', 'DOMAIN')),
    target_id UUID NOT NULL,
    max_limit INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure a single user or domain can't have multiple limit rules for the same feature
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_feature_target 
ON public.feature_limits (feature_name, target_type, target_id);

-- Enable RLS but let super admin bypass, and users can read their own (optional, can just disable RLS since it's admin managed)
ALTER TABLE public.feature_limits ENABLE ROW LEVEL SECURITY;

-- Allow all read/write for service_role
CREATE POLICY "Enable all for service-role" 
ON public.feature_limits FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);
