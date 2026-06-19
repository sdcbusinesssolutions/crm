const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    console.log('🚀 Starting Database Migration...');

    const csvPath = path.join(__dirname, '../../domains.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const dbConnIndex = headers.indexOf('DbConnection');
    const domainIndex = headers.indexOf('Domain');
    const runLocalIndex = headers.indexOf('RunLocal');

    let connectionString = null;
    let targetDomain = null;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',');
        const isRunLocal = row[runLocalIndex] && row[runLocalIndex].trim().toLowerCase() === 'true';

        if (isRunLocal) {
            targetDomain = row[domainIndex].trim();
            connectionString = row[dbConnIndex].trim();
            break;
        }
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully.');

        const sqlPath = path.join(__dirname, '../sql/213_add_signup_fields_and_notifications.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('⏳ Executing Query...');
        await client.query(sqlContent);
        console.log('🎉 Migration Completed Successfully!');

        await client.query("NOTIFY pgrst, 'reload schema';");
    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
    } finally {
        await client.end();
    }
}

runMigration();
