require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testInsert() {
    const { data, error } = await supabase
        .from('drip_campaigns')
        .insert({
            user_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
            name: 'Test',
            description: '',
            trigger_type: 'MANUAL',
            trigger_value: '',
            stop_on_reply: true,
            allow_reentry: false,
            status: 'DRAFT',
            allowed_days: '0,1,2,3,4,5,6',
            time_window_start: '00:00',
            time_window_end: '23:59'
        });

    if (error) {
        console.error('INSERT ERROR:', error);
    } else {
        console.log('INSERT SUCCESS:', data);
    }
}

testInsert();
