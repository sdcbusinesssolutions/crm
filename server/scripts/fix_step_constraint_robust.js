const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// TRY BOTH LAYERS for .env
const possiblePaths = [
    path.join(__dirname, '../.env'),      // server/.env
    path.join(__dirname, '../../.env'),   // root/.env
    path.join(__dirname, '../../../.env') // just in case
];

let connectionString = null;

for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
        console.log('Found .env at:', envPath);
        const envContent = fs.readFileSync(envPath, 'utf8');

        // Simple regex parser instead of split
        const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
        const supabaseUrlMatch = envContent.match(/SUPABASE_DB_URL=(.+)/); // Some projects use this

        if (dbUrlMatch) connectionString = dbUrlMatch[1].trim();
        else if (supabaseUrlMatch) connectionString = supabaseUrlMatch[1].trim();

        if (connectionString) {
            // Remove quotes if present
            connectionString = connectionString.replace(/['"]+/g, '');
            break;
        }
    }
}

if (!connectionString) {
    console.error('❌ DATABASE_URL not found in user .env files!');
    // Allow user to set env var directly
    if (process.env.DATABASE_URL) connectionString = process.env.DATABASE_URL;
    else process.exit(1);
}

console.log('✅ Found Connection String. Connecting...');

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

const sql = `
DO $$
BEGIN
    ALTER TABLE public.drip_steps 
    DROP CONSTRAINT IF EXISTS drip_steps_step_type_check;

    ALTER TABLE public.drip_steps 
    ADD CONSTRAINT drip_steps_step_type_check 
    CHECK (step_type IN ('WHATSAPP_MESSAGE', 'EMAIL', 'WAIT', 'CONDITION', 'AI_INTENT'));
END $$;
`;

(async () => {
    try {
        await client.connect();
        console.log('✅ Connected to Database!');
        await client.query(sql);
        console.log('🚀 SUCCESS: Updated constraint! AI Intent is now ALLOWED.');
    } catch (err) {
        console.error('❌ DB Error:', err.message);
    } finally {
        await client.end();
    }
})();
