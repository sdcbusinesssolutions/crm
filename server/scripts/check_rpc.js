
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkRPC() {
    try {
        console.log('Testing RPC call...');
        const { data, error } = await supabase.rpc('fetch_and_lock_drip_jobs', { batch_size: 1 });
        if (error) {
            console.log('❌ RPC call failed:', error.message);
            if (error.message.includes('not found')) {
                console.log('Postgres function "fetch_and_lock_drip_jobs" is missing.');
            }
        } else {
            console.log('✅ RPC call successful. Data:', JSON.stringify(data));
        }
    } catch (e) { console.error(e); }
}
checkRPC();
