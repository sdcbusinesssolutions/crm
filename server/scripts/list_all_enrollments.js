
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function listAll() {
    try {
        const { data, error } = await supabase
            .from('drip_enrollments')
            .select('id, contact_id, status, started_at, next_run_at')
            .order('started_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;

        if (data && data.length > 0) {
            console.log(`History of enrollments (${data.length}):`);
            data.forEach(e => console.log(`- Enrollment: ${e.id} | Contact: ${e.contact_id} | Status: ${e.status} | Started: ${e.started_at}`));
        } else {
            console.log('No enrollments found at all.');
        }
    } catch (e) {
        console.error(e);
    }
}
listAll();
