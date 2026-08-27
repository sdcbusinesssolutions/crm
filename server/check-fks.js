const { Client } = require('pg');
const connectionString = 'postgresql://postgres.ssckorsnhjhzqxyukexm:sonuDEV%402211@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

async function run() {
    const client = new Client({ connectionString });
    await client.connect();
    
    try {
        const res = await client.query(`
            SELECT
                tc.table_name,
                pg_get_constraintdef(c.oid) AS constraint_def
            FROM pg_constraint c
            JOIN pg_class t ON c.conrelid = t.oid
            JOIN information_schema.table_constraints tc ON tc.constraint_name = c.conname
            WHERE pg_get_constraintdef(c.oid) LIKE '%REFERENCES auth.users(id)%';
        `);
        console.table(res.rows);
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}
run();
