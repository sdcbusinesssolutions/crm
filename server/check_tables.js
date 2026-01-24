const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listTables() {
    console.log('--- Listing Tables ---');
    // Supabase generic way to list tables via PostgREST might not list all, but we can try to find the join table.
    // Or we can guess typical names check if they exist.

    const candidates = ['contact_groups', 'contact_group_members', 'group_members', 'groups_contacts'];

    for (const table of candidates) {
        const { data, error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (!error) {
            console.log(`Table '${table}' exists.`);
            // Inspect one row
            const { data: row } = await supabase.from(table).select('*').limit(1);
            if (row && row.length) console.log(`  Sample row:`, row[0]);
        } else {
            console.log(`Table '${table}' check failed:`, error.code);
        }
    }
}

listTables();
