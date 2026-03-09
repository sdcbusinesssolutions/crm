
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkRecent() {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    console.log(`Checking enrollments since: ${tenMinsAgo}`);
    const { data, error } = await supabase.from('drip_enrollments').select(`
        id, status, started_at, next_run_at, 
        contact:contacts(name, phone)
    `).gte('started_at', tenMinsAgo);
    
    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (data && data.length > 0) {
        console.log(`FOUND ${data.length} NEW ENROLLMENTS:`);
        data.forEach(e => {
            console.log(`- Enrollment: ${e.id} | Contact: ${e.contact?.name} (${e.contact?.phone}) | Status: ${e.status}`);
        });
    } else {
        console.log('No new enrollments found in the last 10 minutes.');
    }
}
checkRecent();
