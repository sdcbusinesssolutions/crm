const { Client } = require('pg');
const connectionString = 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        // Find exact constraint names for these tables
        const res = await client.query(`
            SELECT
                tc.table_name,
                tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
            WHERE tc.table_name IN ('whatsapp_flow_submissions', 'drip_campaigns', 'follow_ups') 
            AND kcu.column_name = 'user_id' AND tc.constraint_type = 'FOREIGN KEY';
        `);
        
        console.table(res.rows);
        
        for (const row of res.rows) {
            console.log(`Fixing ${row.table_name}.${row.constraint_name}...`);
            await client.query(`ALTER TABLE public.${row.table_name} DROP CONSTRAINT "${row.constraint_name}";`);
            await client.query(`ALTER TABLE public.${row.table_name} ADD CONSTRAINT "${row.constraint_name}" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;`);
        }
        console.log('Fixed successfully!');
        
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
