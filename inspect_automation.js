const { supabaseAdmin } = require('./server/lib/supabaseClient');
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

async function run() {
    const { data, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*')
        .limit(1);

    if (data && data.length > 0) {
        console.log('Automation Data:');
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('No automations found.');
        if (error) console.error(error);
    }
}
run();
