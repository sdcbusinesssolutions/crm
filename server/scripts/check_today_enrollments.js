
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkToday() {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        console.log(`Checking enrollments created after: ${todayISO}`);
        
        const { data: enrollments, error } = await supabase
            .from('drip_enrollments')
            .select('id, drip_campaign_id, contact_id, status, started_at')
            .gte('started_at', todayISO)
            .order('started_at', { ascending: false });
        
        if (error) throw error;

        if (!enrollments || enrollments.length === 0) {
            console.log('No enrollments created today yet.');
        } else {
            console.log(`Found ${enrollments.length} enrollments today.`);
            enrollments.forEach(e => console.log(`- Enrollment: ${e.id} | Status: ${e.status} | Created: ${e.created_at}`));
        }

    } catch (e) { console.error(e); }
}
checkToday();
