const { Client } = require('pg');
const connectionString = 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();
    
    const query = `
    SELECT trigger_name, action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'users' AND event_object_schema = 'auth';
    `;
    
    try {
        const res = await client.query(query);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
