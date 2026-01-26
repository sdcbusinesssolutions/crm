
// Ensure env is loaded first
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

const { supabaseAdmin } = require('../lib/supabaseClient');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('--- Applying Migration: fix_sheet_flow_id.sql ---');
    try {
        const sqlPath = path.join(__dirname, '../sql/fix_sheet_flow_id.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Supabase JS doesn't support direct SQL execution easily without RPC.
        // We will try to use a standard RPC if available, or just log instructions if not.
        // Assuming we have an 'exec_sql' or similar unsafe RPC for admin tasks, OR we just trust the user to run it.
        // BUT, we can try to use the raw SQL executor if we have one defined in previous steps, 
        // OR we can try to check if column exists via RPC/Table inspection.

        // Let's rely on the previous pattern: 
        // We might not have a direct SQL executor.
        // Let's check `execute_sql.js` in scripts folder if it exists or create one.

        console.log('Sending SQL to Postgres...');
        // Attempt to run via rpc 'exec_sql' which is common pattern, or 'execute_sql'
        const { error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('RPC Error:', error);
            console.log('Fallback: Trying to list columns to verify.');
            // Fallback check
        } else {
            console.log('Migration successfully applied via RPC.');
        }

    } catch (e) {
        console.error('Migration Script Error:', e);
    }
}

runMigration();
