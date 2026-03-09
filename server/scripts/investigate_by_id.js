
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function investigate() {
    const contactId = '048d4684-4678-4cee-8a4f-a1c4f6a224cc'; // The confirmed ID from 919373393645
    console.log(`--- Investigating Contact ID: ${contactId} ---`);
    
    // Enrollments
    const { data: envs } = await supabase.from('drip_enrollments').select(`
        id, status, started_at, next_run_at, 
        drip_campaigns(name)
    `).eq('contact_id', contactId);
    
    if (envs?.length > 0) {
        envs.forEach(e => console.log(`Enrollment: ${e.id} | Campaign: ${e.drip_campaigns?.name} | Status: ${e.status} | Next: ${e.next_run_at}`));
    } else {
        console.log('❌ NO ENROLLMENT found for this ID.');
    }

    // Logs
    const { data: logs } = await supabase.from('drip_logs').select('*').eq('contact_id', contactId).order('created_at', { ascending: false });
    if (logs?.length > 0) {
        logs.forEach(l => console.log(`Log: ${l.created_at} | Action: ${l.action_type} | Details: ${JSON.stringify(l.details)}`));
    } else {
        console.log('❌ NO LOGS found for this ID.');
    }
}
investigate();
