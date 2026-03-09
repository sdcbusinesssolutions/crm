
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    console.log('--- FINAL STATUS CHECK ---');
    const { data: envs } = await supabase.from('drip_enrollments').select(`
        id, status, started_at, next_run_at, last_run_at,
        contact:contacts(name, phone)
    `).order('started_at', { ascending: false }).limit(3);
    
    if (envs) {
        envs.forEach(e => {
            console.log(`Contact: ${e.contact?.name} (${e.contact?.phone})`);
            console.log(`  ID: ${e.id}`);
            console.log(`  Status: ${e.status}`);
            console.log(`  Started: ${e.started_at}`);
            console.log(`  Next: ${e.next_run_at}`);
            console.log(`  Last: ${e.last_run_at}`);
        });
    }

    const { data: logs } = await supabase.from('drip_logs').select('*').order('created_at', { ascending: false }).limit(3);
    if (logs) {
        console.log('\n--- RECENT LOGS ---');
        logs.forEach(l => {
            console.log(`- ${l.created_at} | ${l.action_type} | ${l.status} | ${JSON.stringify(l.details)}`);
        });
    }
}
run();
