const { Client } = require('pg');

async function checkSchema(connectionString, name) {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);
        console.log(`\n--- Tables in ${name} ---`);
        console.log(res.rows.map(r => r.table_name).join(', '));
    } catch (e) {
        console.error(`Error connecting to ${name}:`, e.message);
    } finally {
        await client.end();
    }
}

async function run() {
    const cloudospire = 'postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
    const clickube = 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
    
    await checkSchema(cloudospire, 'cloudospire');
    await checkSchema(clickube, 'clickube');
}

run();
