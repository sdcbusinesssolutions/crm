const fs = require('fs');
const path = require('path');
const { supabaseAdmin } = require('./server/lib/supabaseClient');
require('dotenv').config({ path: './server/.env' });

const sqlFile = process.argv[2];

if (!sqlFile) {
    console.error('Please provide a SQL file path');
    process.exit(1);
}

const sqlContent = fs.readFileSync(sqlFile, 'utf8');

async function runSql() {
    console.log(`Executing SQL from ${sqlFile}...`);

    // Supabase JS client doesn't support raw SQL execution directly on the client 
    // unless via a specific RPC or using PG library.
    // However, for this environment, often we rely on a helper or need to use the 'postgres' package if available.
    // Assuming we DON'T have direct PG access, we try to use an RPC 'exec_sql' if it exists, 
    // or we might need to instruct the user if we can't contextually run it.

    // BUT, since we have 'supabaseAdmin', let's check if we can simply use the REST API 
    // No, standard Supabase client doesn't do raw SQL.

    // Check if there is a 'postgres' connection string in .env
    const pg = require('pg');
    if (process.env.DATABASE_URL) {
        const client = new pg.Client({
            connectionString: process.env.DATABASE_URL,
        });
        await client.connect();
        try {
            await client.query(sqlContent);
            console.log('SQL Executed Successfully');
        } catch (err) {
            console.error('SQL Execution Failed:', err);
        } finally {
            await client.end();
        }
    } else {
        console.error('DATABASE_URL not found in environment.');
    }
}

runSql();
