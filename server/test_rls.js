require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkRLS() {
    // We can query pg_policies using an RPC, but we might not have one.
    // Alternatively, we can just fetch the schema. 
    // Since we can't query pg_policies directly via Supabase-js unless there's an RPC, 
    // we might need to use the pg module to connect directly.
    
    // We have postgresql:// URL in domains.csv:
    // postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
    
    const { Client } = require('pg');
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    
    const res = await client.query(`
        SELECT cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'drip_campaigns';
    `);
    
    console.log("RLS Policies for drip_campaigns:");
    console.log(res.rows);
    
    const resColumns = await client.query(`
        SELECT column_name, is_nullable, column_default 
        FROM information_schema.columns 
        WHERE table_name = 'drip_campaigns';
    `);
    
    console.log("Columns for drip_campaigns:");
    console.log(resColumns.rows);
    
    await client.end();
}

checkRLS();
