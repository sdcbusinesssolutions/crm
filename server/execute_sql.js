const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runSql() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node execute_sql.js <path_to_sql_file>');
        process.exit(1);
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('Missing DATABASE_URL in .env');
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase usually
    });

    try {
        await client.connect();
        console.log('Connected to Database.');

        const filePath = path.resolve(process.cwd(), sqlFile);
        const sql = fs.readFileSync(filePath, 'utf8');

        console.log(`Executing SQL from ${sqlFile}...`);
        await client.query(sql);

        console.log('✅ SQL executed successfully.');
    } catch (err) {
        console.error('❌ SQL execution failed:', err);
    } finally {
        await client.end();
    }
}

runSql();
