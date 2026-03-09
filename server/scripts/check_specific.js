
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkSpecific() {
    const { data } = await supabase.from('contacts').select('*').eq('phone', '918408907516').single();
    if (data) {
        console.log('Found number:', data.id);
    } else {
        const { data: all } = await supabase.from('contacts').select('id, phone').limit(1);
        console.log('Number NOT found. Using alternate:', all[0].phone, all[0].id);
    }
}
checkSpecific();
