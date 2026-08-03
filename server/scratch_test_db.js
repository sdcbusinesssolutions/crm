const { Client } = require('pg');

async function testConnection() {
  const connectionString = 'postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';
  
  const client = new Client({
    connectionString,
  });

  try {
    console.log('Attempting to connect to the database...');
    await client.connect();
    console.log('Successfully connected!');
    
    // Check tables to verify it is working
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log(`\nFound ${res.rows.length} tables in the 'public' schema:`);
    res.rows.forEach(row => {
      console.log(`- ${row.table_name}`);
    });
    
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.end();
  }
}

testConnection();
