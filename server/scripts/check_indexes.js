const { Client } = require('pg');

const connectionString = 'postgresql://postgres.dndmbarbnsdlbclghkbs:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const client = new Client({
  connectionString: connectionString,
});

async function run() {
  try {
    await client.connect();
    
    const query = `
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_name IN (
        'campaign_queue', 'whatsapp_flow_submissions', 'drip_enrollments', 'follow_ups',
        'conversations', 'leads', 'tasks', 'notes', 'appointments', 'flow_sessions', 'messages', 'drip_logs'
      )
      AND column_name = 'contact_id';
    `;
    
    const res = await client.query(query);
    console.log("Tables with contact_id:");
    console.table(res.rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
