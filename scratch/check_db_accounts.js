const { Client } = require('pg');
const dns = require('dns').promises;

async function checkDb() {
    const host = 'aws-1-ap-northeast-1.pooler.supabase.com';
    console.log(`🌐 Resolving ${host} to IPv4...`);
    const lookup = await dns.lookup(host, { family: 4 });
    const ip = lookup.address;
    
    const connectionString = `postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@${ip}:5432/postgres`;
    const client = new Client({ 
        connectionString,
        ssl: { rejectUnauthorized: false }
    });
    
    await client.connect();
    console.log('✅ Connected.');
    
    // 1. Query Profiles
    console.log('\n📊 User Profiles (from profiles table):');
    const { rows: profiles } = await client.query('SELECT * FROM profiles');
    console.table(profiles);
    
    // 2. Query Staff columns
    console.log('\n📋 Team Staff Columns:');
    const { rows: columns } = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'team_staff'
    `);
    console.table(columns);
    
    // 3. Query Staff records
    console.log('\n👥 Team Staff Records:');
    try {
        const { rows: staff } = await client.query('SELECT * FROM team_staff');
        console.table(staff);
    } catch (err) {
        console.error('❌ Error querying team_staff:', err.message);
    }
    
    await client.end();
}

checkDb().catch(console.error);
