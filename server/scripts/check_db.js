const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
console.log('Running Schema Check...');
console.log(`Target URL: ${SUPABASE_URL}`);

const tables = ['flows', 'contacts', 'campaigns', 'whatsapp_config', 'webhook_logs'];

for (const table of tables) {
    // Try to select 1 row. 
    // If table exists but RLS blocks, we get 401 or empty data, not 42P01.
    // If table missing, we get 42P01.
    const { data, error } = await supabase.from(table).select('id').limit(1);

    if (error) {
        // console.error(`Error checking table '${table}':`, error);
        if (error.code === '42P01') {
            console.error(`❌ CRITICAL: Table '${table}' DOES NOT EXIST.`);
        } else if (error.code === 'PGRST301' || error.code === '401') {
            console.log(`⚠️ Table '${table}' exists but access denied (RLS). This is expected if using Anon key.`);
        } else {
            console.log(`✓ Table '${table}' exists (Error: ${error.message} - implies table present).`);
        }
    } else {
        console.log(`✓ Table '${table}' exists.`);
    }
}

console.log('\n--- Note ---');
console.log('If any tables are marked CRITICAL MISSING, please run the SQL in db_sql/MASTER_SCHEMA.sql in your Supabase SQL Editor.');
}

runSchema();
