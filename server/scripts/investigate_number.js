
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSpecificNumber() {
    const phone = '9373393645';
    console.log(`--- Investigating Phone: ${phone} ---`);
    
    // 1. Check Contact
    const { data: contact } = await supabase.from('contacts').select('*').eq('phone', phone).maybeSingle();
    if (!contact) {
        console.log('❌ Contact NOT found in database.');
        return;
    }
    console.log(`✅ Contact found. ID: ${contact.id}`);

    // 2. Check Enrollments for this contact
    const { data: enrolls } = await supabase.from('drip_enrollments').select(`
        id, status, started_at, next_run_at, last_run_at, current_step_id, drip_campaign_id,
        drip_campaigns(name)
    `).eq('contact_id', contact.id);
    
    if (!enrolls || enrolls.length === 0) {
        console.log('❌ No enrollments found for this contact. It was never added to a campaign.');
    } else {
        console.log(`Found ${enrolls.length} enrollment(s):`);
        enrolls.forEach(e => {
            console.log(`- Campaign: ${e.drip_campaigns?.name} | Status: ${e.status} | Started: ${e.started_at} | Next: ${e.next_run_at}`);
        });
    }

    // 3. Check Logs for this contact
    const { data: logs } = await supabase.from('drip_logs').select('*').eq('contact_id', contact.id).order('created_at', { ascending: false });
    if (logs && logs.length > 0) {
        console.log(`\nFound ${logs.length} log(s):`);
        logs.forEach(l => {
            console.log(`- Time: ${l.created_at} | Action: ${l.action_type} | Status: ${l.status} | Details: ${JSON.stringify(l.details)}`);
        });
    } else {
        console.log('\n❌ No execution logs found for this contact.');
    }
}
checkSpecificNumber();
