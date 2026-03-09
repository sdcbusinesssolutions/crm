const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkActivity() {
    try {
        console.log('--- Recent Activity Check ---');
        
        // Check Enrollments
        console.log('\nEnrollments:');
        const { data: enrollments } = await supabase
            .from('drip_enrollments')
            .select('id, contact_id, status, started_at, last_run_at, next_run_at, contacts(name, phone)')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (enrollments?.length > 0) {
            enrollments.forEach(e => {
                console.log(`- ID: ${e.id} | Contact: ${e.contacts?.name} (${e.contacts?.phone}) | Status: ${e.status} | Last Run: ${e.last_run_at}`);
            });
        } else {
            console.log('No enrollments found.');
        }

        // Check Logs
        console.log('\nRecent Logs:');
        const { data: logs } = await supabase
            .from('drip_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);
        
        if (logs?.length > 0) {
            logs.forEach(l => {
                console.log(`- Time: ${l.created_at} | Type: ${l.action_type} | Contact ID: ${l.contact_id} | Details: ${JSON.stringify(l.details)}`);
            });
        } else {
            console.log('No logs found.');
        }

    } catch (e) {
        console.error('Check failed:', e);
    }
}

checkActivity();
