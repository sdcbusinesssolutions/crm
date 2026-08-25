const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres'
});

async function run() {
  try {
    await client.connect();
    const res = await client.query("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('contacts', 'leads', 'campaign_queue', 'conversations');");
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('Connection error', err.stack);
  } finally {
    await client.end();
  }
}
run();
