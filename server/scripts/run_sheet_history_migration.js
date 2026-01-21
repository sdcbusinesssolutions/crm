const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    console.log('🚀 Starting Sheet History Migration...');

    // 1. Read domains.csv directly to find 'RunLocal' = true
    const csvPath = path.join(__dirname, '../../domains.csv');
    console.log(`📂 Reading configuration from: ${csvPath}`);

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const dbConnIndex = headers.indexOf('DbConnection');
    const runLocalIndex = headers.indexOf('RunLocal');

    if (dbConnIndex === -1 || runLocalIndex === -1) {
        console.error('❌ Error: domains.csv missing necessary columns.');
        process.exit(1);
    }

    let connectionString = null;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',');

        // Check if RunLocal column is 'true'
        if (row[runLocalIndex] && row[runLocalIndex].trim().toLowerCase() === 'true') {
            connectionString = row[dbConnIndex].trim();
            break;
        }
    }

    if (!connectionString) {
        console.error('❌ Error: No domain found in domains.csv with RunLocal=true');
        process.exit(1);
    }

    console.log('🔌 Connecting to database...');

    // 2. Connect
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully.');

        // 3. Read SQL File
        const sqlPath = path.join(__dirname, '../../db_sql/create_sheet_history_table.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log(`📄 Read SQL file: create_sheet_history_table.sql`);

        // 4. Execute
        console.log('⏳ Executing Query...');
        await client.query(sqlContent);

        console.log('🎉 Migration Completed Successfully!');

        console.log('🔄 Reloading Supabase Schema Cache...');
        await client.query("NOTIFY pgrst, 'reload schema';");

    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();
