const { supabaseAdmin } = require('../lib/supabaseClient');
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

async function listAll() {
    const { data } = await supabaseAdmin.from('sheet_automations').select('*');
    console.log(JSON.stringify(data, null, 2));
}
listAll();
