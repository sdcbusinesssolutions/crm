require('dotenv').config();
const { Client } = require('pg');

async function checkDripLogs() {
    const client = new Client({
        connectionString: 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
    });
    
    await client.connect();
    const res = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'drip_logs';
    `);
    console.log("drip_logs columns:", res.rows.map(r => r.column_name));
    
    // Let's just create a simple policy for drip_logs if it has a campaign_id or drip_campaign_id
    // Wait, let's see columns first.
    await client.end();
}

checkDripLogs();
