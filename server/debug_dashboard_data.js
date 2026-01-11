
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugSchema3() {
    console.log('--- Debug V4 ---');

    // Check Messages columns
    const { data: m, error: me } = await supabase.from('messages').select('status, direction').limit(1);
    if (me) console.log('Messages Check Error:', me.message);
    else console.log('Messages has status/direction: YES');

    // Check Leads dates
    // Find a user first
    const { data: t } = await supabase.from('tasks').select('user_id').limit(1);
    const userId = t && t[0]?.user_id;

    if (userId) {
        const { data: l } = await supabase.from('leads').select('created_at').eq('user_id', userId).limit(5);
        console.log('Sample Lead Dates:', JSON.stringify(l));
    }
}

debugSchema3().catch(console.error);
