const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get Arguments
const dbUrl = process.argv[2];
const filePath = process.argv[3];

if (!dbUrl || !filePath) {
    console.error('Usage: node restore_db.js <DB_URL> <SQL_FILE_PATH>');
    process.exit(1);
}

// Check if file exists
if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exit(1);
}

const restore = async () => {
    console.log('Connecting to database...');
    // Allow self-signed certs for Supabase/AWS
    const client = new Client({
        connectionString: dbUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected successfully.');

        console.log(`Reading SQL file: ${filePath}`);
        const sqlContent = fs.readFileSync(filePath, 'utf8');

        console.log('Executing SQL (this might take a while)...');
        console.log(`Size: ${(sqlContent.length / 1024 / 1024).toFixed(2)} MB`);

        // Execute the entire file contents as a query
        await client.query(sqlContent);

        console.log('✅ Restore execution finished successfully.');

    } catch (err) {
        console.error('❌ Restore failed:', err.message);
        if (err.position) {
            console.error(`Position: ${err.position}`);
        }
    } finally {
        await client.end();
    }
};

restore();
