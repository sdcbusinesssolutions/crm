const { Client } = require('pg');
require('dotenv').config({ path: '../.env' }); // Adjusted path relative to script

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('DATABASE_URL not found in environment!');
    process.exit(1);
}

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

async function run() {
    try {
        await client.connect();
        console.log('Connected to DB...');
        await client.query(sql);
        console.log('SUCCESS: Drip Step Type Constraint Updated!');
    } catch (err) {
        console.error('ERROR updating constraints:', err);
    } finally {
        await client.end();
    }
}

run();
