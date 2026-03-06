require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');

async function run() {
    const { data, error } = await supabaseAdmin
        .from('messages')
        .select('*')
        .eq('type', 'template')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error) {
        console.error(error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}
run();
