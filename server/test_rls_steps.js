require('dotenv').config();
const { Client } = require('pg');

async function checkDripStepsRLS() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    
    const res = await client.query(`SELECT relrowsecurity FROM pg_class WHERE relname = 'drip_steps';`);
    console.log("RLS enabled on drip_steps:", res.rows[0]?.relrowsecurity);
    
    const resPol = await client.query(`
        SELECT cmd, qual, with_check 
        FROM pg_policies 
        WHERE tablename = 'drip_steps';
    `);
    console.log("Policies on drip_steps:", resPol.rows);
    
    await client.end();
}

checkDripStepsRLS();
