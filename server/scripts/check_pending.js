
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkPending() {
    try {
        const now = new Date().toISOString();
        console.log(`Checking pending enrollments before: ${now}`);
        
        const { data: enrollments, error } = await supabase
            .from('drip_enrollments')
            .select('id, status, next_run_at, contact_id, drip_campaign_id')
            .eq('status', 'ACTIVE')
            .lte('next_run_at', now)
            .limit(10);
        
        if (error) throw error;

        if (!enrollments || enrollments.length === 0) {
            console.log('No pending active enrollments (next_run_at < now).');
        } else {
            console.log(`Found ${enrollments.length} pending enrollments.`);
            enrollments.forEach(e => console.log(`- ID: ${e.id} | Next Run: ${e.next_run_at}`));
        }

    } catch (e) { console.error(e); }
}
checkPending();
