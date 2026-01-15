const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function verify() {
    console.log('🚀 Verifying Table Existence...');

    // Load connection from same logic as migration to ensure we check the RIGHT db
    const domain = process.env.DOMAIN;
    console.log(`target Domain from .env: ${domain}`);

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

        const res = await client.query("SELECT to_regclass('public.profiles') as exists;");
        // Simplified Log
        if (res.rows[0].exists) {
            console.log('TABLE_EXISTS: YES');
            const countRes = await client.query('SELECT count(*) FROM public.profiles');
            console.log('ROW_COUNT: ' + countRes.rows[0].count);
        } else {
            console.log('TABLE_EXISTS: NO');
        }

    } catch (err) {
        console.error('❌ Verification Error:', err);
    } finally {
        await client.end();
    }
}

verify();
