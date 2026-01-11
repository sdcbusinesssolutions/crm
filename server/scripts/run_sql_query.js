require('dotenv').config({ path: './server/.env' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const sqlPath = process.argv[2];
    if (!sqlPath) {
        console.error("Please provide SQL file path");
        process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Using a direct function call or query if RPC is not set up for raw SQL
    // Since we don't have a generic exec_sql RPC, we might need to rely on psql or a specific RPC.
    // Let's assume there is likely NO raw SQL execution RPC exposed for security.

    // ALTERNATIVE: Use pg library directly if connection string is available.
    // BUT we usually only have Supabase URL/Key.
    // CHECK if we can use an existing "execute_sql" rpc or similar.

    // Let's try to assume we have a `exec_sql` or similar RPC, OR use the dashboard.
    // If not, we can try to use the `pg` driver if DATABASE_URL is in env.

    // Looking at .env file from previous steps might help.
    // Let's try to use the `pg` client if we can find the connection string.

    // For now, let's try a common RPC pattern 'exec_sql'
    const { data, error } = await supabase.rpc('exec_sql', { query: sqlContent });

    if (error) {
        // Fallback: Check if we have DATABASE_URL
        if (process.env.DATABASE_URL) {
            console.log("RPC failed, trying DATABASE_URL with pg client...");
            const { Client } = require('pg');
            const client = new Client({ connectionString: process.env.DATABASE_URL });
            await client.connect();
            await client.query(sqlContent);
            await client.end();
            console.log("SQL Executed via PG Client");
        } else {
            console.error("RPC Error and no DATABASE_URL:", error);
        }
    } else {
        console.log("SQL Executed via RPC:", data);
    }
}

run();
