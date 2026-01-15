const pg = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || process.env.VITE_SUPABASE_DB_URL;

if (!dbUrl) {
    console.error('No DATABASE_URL found');
    process.exit(1);
}

const client = new pg.Client({ connectionString: dbUrl });

async function check() {
    await client.connect();
    try {
        const res = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'profiles'
            );
        `);
        console.log('Table "profiles" exists:', res.rows[0].exists);

        if (res.rows[0].exists) {
            const count = await client.query('SELECT COUNT(*) FROM public.profiles');
            console.log('Row count:', count.rows[0].count);

            const user = await client.query("SELECT * FROM public.profiles WHERE email = 'api@gmail.com'");
            console.log('User Record via PG:', user.rows);
        }
    } catch (err) {
        console.error('PG Error:', err);
    } finally {
        await client.end();
    }
}

check();
