const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function diagnose() {
    console.log('🚀 Starting Diagnostics...');
    const domain = process.env.DOMAIN;
    console.log(`target Domain: ${domain}`);

    // Quick CSV parse
    const csvPath = path.join(__dirname, '../../domains.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',');
    const dbConnIndex = headers.findIndex(h => h.trim() === 'DbConnection');
    const domainIndex = headers.findIndex(h => h.trim() === 'Domain');

    let connectionString = null;
    for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',');
        if (row.length > domainIndex && row[domainIndex].trim() === domain) {
            connectionString = row[dbConnIndex].trim();
            break;
        }
    }

    if (!connectionString) {
        console.error('❌ No connection string found.');
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'auth' AND table_name = 'users'
            ORDER BY column_name;
        `);
        const columns = res.rows.map(r => r.column_name);
        fs.writeFileSync('diagnose_output.json', JSON.stringify(columns, null, 2));
        console.log('✅ diagnostics written to diagnose_output.json');

    } catch (err) {
        console.error('❌ Diagnostics Error:', err);
    } finally {
        await client.end();
    }
}

diagnose();
