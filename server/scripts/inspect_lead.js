
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function inspect() {
    const { data: contacts, error: cErr } = await supabase.from('contacts').select('id, name').eq('email', 'ram@ram.com');
    if (cErr) console.log('Contact Err:', cErr);
    console.log('Contacts:', contacts);

    if (contacts && contacts.length > 0) {
        const { data: leads, error: lErr } = await supabase.from('leads').select('*').eq('contact_id', contacts[0].id);
        if (lErr) console.log('Lead Err:', lErr);
        console.log('Leads:', leads);
    }
}

inspect();
