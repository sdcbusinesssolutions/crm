
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { data } = await supabase.from('drip_enrollments').select('*').gte('started_at', today.toISOString());
    console.log('COUNT_TODAY:', data?.length || 0);
    if (data && data.length > 0) {
        data.forEach(e => console.log(`  - Enrollment ${e.id} Status: ${e.status}`));
    }
}
checkToday();
