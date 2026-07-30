-- Enable RLS on the tags table (in case it wasn't enabled)
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
        
-- Policy: Allow users to view their own tags
DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
CREATE POLICY "Users can view their own tags"
    ON tags FOR SELECT
    USING (auth.uid() = user_id);
            
-- Policy: Allow users to insert tags tied to their own user_id
-- (This was the missing policy causing your "Failed to save tag" error!)
DROP POLICY IF EXISTS "Users can insert their own tags" ON tags;
CREATE POLICY "Users can insert their own tags"
    ON tags FOR INSERT
    WITH CHECK (auth.uid() = user_id);
            
-- Policy: Allow users to update their own tags
DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
CREATE POLICY "Users can update their own tags"
    ON tags FOR UPDATE
    USING (auth.uid() = user_id);
            
-- Policy: Allow users to delete their own tags
DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;
CREATE POLICY "Users can delete their own tags"
    ON tags FOR DELETE
    USING (auth.uid() = user_id);
            
-- Tell PostgREST to reload the schema so the API recognizes the new policies
NOTIFY pgrst, 'reload schema';
