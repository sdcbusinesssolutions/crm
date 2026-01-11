-- Fix Data Isolation for Forms Dashboard
-- The previous policy allowed ANY authenticated user (including Dashboard users) to see ALL active forms.
-- We must restrict the "Public View" policy to only apply to Anonymous users (getting forms by token via public API).

-- 1. Drop the overly permissive policy
DROP POLICY IF EXISTS "Public view active forms" ON public.forms;

-- 2. Create the strict policy for Anonymous users only
-- This ensures authenticated users (Dashboard) ONLY match the "Users can view their own forms" policy
CREATE POLICY "Public view active forms" ON public.forms 
FOR SELECT 
TO anon 
USING (is_active = true);

-- 3. Ensure Strict Isolation for Authenticated Users (just in case)
DROP POLICY IF EXISTS "Users can view their own forms" ON public.forms;
CREATE POLICY "Users can view their own forms" ON public.forms 
FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Ensure Write policies are strict
DROP POLICY IF EXISTS "Users can insert their own forms" ON public.forms;
CREATE POLICY "Users can insert their own forms" ON public.forms 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own forms" ON public.forms;
CREATE POLICY "Users can update their own forms" ON public.forms 
FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own forms" ON public.forms;
CREATE POLICY "Users can delete their own forms" ON public.forms 
FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);
