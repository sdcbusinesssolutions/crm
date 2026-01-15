const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

async function runMigration() {
    console.log('🚀 Starting Database Migration...');

    // 1. Read domains.csv directly to find 'RunLocal' = true
    const csvPath = path.join(__dirname, '../../domains.csv');
    console.log(`📂 Reading configuration from: ${csvPath}`);

    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());

    const dbConnIndex = headers.indexOf('DbConnection');
    const domainIndex = headers.indexOf('Domain');
    const runLocalIndex = headers.indexOf('RunLocal');

    if (dbConnIndex === -1 || domainIndex === -1 || runLocalIndex === -1) {
        console.error('❌ Error: domains.csv missing necessary columns (Domain, DbConnection, RunLocal).');
        process.exit(1);
    }

    let connectionString = null;
    let targetDomain = null;

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',');

        // Check if RunLocal column is 'true'
        const isRunLocal = row[runLocalIndex] && row[runLocalIndex].trim().toLowerCase() === 'true';

        if (isRunLocal) {
            targetDomain = row[domainIndex].trim();
            connectionString = row[dbConnIndex].trim();
            break; // Found it
        }
    }

    if (!targetDomain || !connectionString) {
        console.error('❌ Error: No domain found in domains.csv with RunLocal=true');
        process.exit(1);
    }

    console.log(`🎯 Target Domain (RunLocal=true): ${targetDomain}`);
    // console.log(`🔌 Connection String: ${connectionString.replace(/:[^:]*@/, ':****@')}`); // Mask password

    // 2. Connect
    const client = new Client({
        connectionString: connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('✅ Connected successfully.');

        // DIAGNOSTICS
        try {
            const resAuth = await client.query("SELECT to_regclass('auth.users') as exists;");
            console.log(`🔍 Check auth.users: ${resAuth.rows[0].exists ? 'FOUND' : 'MISSING (Critical!)'}`);

            if (resAuthCallback = resAuth.rows[0].exists) {
                const resCols = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users';");
                // console.log('🔍 auth.users columns:', resCols.rows.map(r => r.column_name).join(', '));
            }

            const resTables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 10;");
            console.log('🔍 Existing public tables:', resTables.rows.map(r => r.table_name).join(', '));
        } catch (diagErr) {
            console.warn('⚠️ Diagnostics failed:', diagErr.message);
        }

        // 3. Read SQL File
        const sqlPath = path.join(__dirname, '../sql/200_combined_multi_tenancy.sql');
        const sqlContent = fs.readFileSync(sqlPath, 'utf8');
        console.log(`📄 Read SQL file: 200_combined_multi_tenancy.sql (${sqlContent.length} bytes)`);

        // 4. Execute
        console.log('⏳ Executing Query...');
        await client.query(sqlContent);

        console.log('🎉 Migration Completed Successfully! All tables created.');

        console.log('🔄 Attempting to notify PostgREST to reload schema (NOTIFY pgrst)...');
        await client.query("NOTIFY pgrst, 'reload schema';");

    } catch (err) {
        console.error('❌ Migration Failed:', err.message);
        if (err.position) {
            console.error(`Position: ${err.position}`);
            const sqlPath = path.join(__dirname, '../sql/200_combined_multi_tenancy.sql');
            const sqlContent = fs.readFileSync(sqlPath, 'utf8');
            const nPos = parseInt(err.position);
            const start = Math.max(0, nPos - 100);
            const end = Math.min(sqlContent.length, nPos + 100);
            console.error('SQL Context:', sqlContent.substring(start, end));
        }
    } finally {
        await client.end();
    }
}

runMigration();
