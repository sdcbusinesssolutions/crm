-- Temporarily disable RLS on tasks to verify if data exists
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;

-- Notify to reload schema cache
NOTIFY pgrst, 'reload config';
