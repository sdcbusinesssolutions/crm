require('dotenv').config();
const { Client } = require('pg');

async function checkAllRLS() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    
    // Find all tables with RLS enabled but no policies
    const res = await client.query(`
        SELECT c.relname as table_name
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind = 'r'
        AND c.relrowsecurity = true
        AND n.nspname = 'public'
        AND NOT EXISTS (
            SELECT 1 FROM pg_policies p WHERE p.tablename = c.relname
        );
    `);
    
    console.log("Tables with RLS enabled but NO policies:");
    res.rows.forEach(r => console.log(r.table_name));
    
    await client.end();
}

checkAllRLS();
