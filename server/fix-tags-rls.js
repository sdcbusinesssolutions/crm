const { Client } = require('pg');
const connectionString = 'postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function fix() {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    
    await client.query(`
        -- Enable RLS
        ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
        
        -- Policy for select
        DROP POLICY IF EXISTS "Users can view their own tags" ON tags;
        CREATE POLICY "Users can view their own tags"
            ON tags FOR SELECT
            USING (auth.uid() = user_id);
            
        -- Policy for insert
        DROP POLICY IF EXISTS "Users can insert their own tags" ON tags;
        CREATE POLICY "Users can insert their own tags"
            ON tags FOR INSERT
            WITH CHECK (auth.uid() = user_id);
            
        -- Policy for update
        DROP POLICY IF EXISTS "Users can update their own tags" ON tags;
        CREATE POLICY "Users can update their own tags"
            ON tags FOR UPDATE
            USING (auth.uid() = user_id);
            
        -- Policy for delete
        DROP POLICY IF EXISTS "Users can delete their own tags" ON tags;
        CREATE POLICY "Users can delete their own tags"
            ON tags FOR DELETE
            USING (auth.uid() = user_id);
            
        NOTIFY pgrst, 'reload schema';
    `);
    console.log("RLS Policies Updated");
    await client.end();
}
fix().catch(e => console.error(e));
