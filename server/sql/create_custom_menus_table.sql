-- Create custom_menus table for reference URLs
CREATE TABLE IF NOT EXISTS public.custom_menus (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'URL',
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS
ALTER TABLE public.custom_menus ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view their own custom menus" ON public.custom_menus;
CREATE POLICY "Users can view their own custom menus" ON public.custom_menus FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own custom menus" ON public.custom_menus;
CREATE POLICY "Users can insert their own custom menus" ON public.custom_menus FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own custom menus" ON public.custom_menus;
CREATE POLICY "Users can update their own custom menus" ON public.custom_menus FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own custom menus" ON public.custom_menus;
CREATE POLICY "Users can delete their own custom menus" ON public.custom_menus FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_menus_user_id ON public.custom_menus(user_id);
