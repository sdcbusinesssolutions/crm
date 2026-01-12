const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugFields() {
    console.log('--- Debugging Custom Fields ---');

    // 1. Check Explicit Fields
    const { data: explicit, error: eErr } = await supabase.from('custom_fields').select('*');
    if (eErr) console.error('Explicit Error:', eErr);
    console.log('Explicit Fields Count:', explicit ? explicit.length : 0);
    console.log('Explicit Fields:', explicit);

    // 2. Check Contacts Custom Data
    const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('phone, custom_data')
        .not('custom_data', 'is', null)
        .limit(5);

    if (cErr) console.error('Contacts Error:', cErr);
    console.log('Contacts Checked:', contacts ? contacts.length : 0);
    if (contacts) {
        contacts.forEach(c => {
            console.log(`Contact ${c.phone} custom_data:`, c.custom_data);
        });
    }

    // 3. Simulate Implicit Logic (Deep Scan)
    const { data: deepContacts } = await supabase
        .from('contacts')
        .select('custom_data')
        .not('custom_data', 'is', null)
        .order('created_at', { ascending: false })
        .limit(500);

    console.log('Deep Scan Count:', deepContacts ? deepContacts.length : 0);

    const implicitSet = new Set();
    const exampleValues = {};

    if (deepContacts) {
        deepContacts.forEach(c => {
            if (c.custom_data && typeof c.custom_data === 'object') {
                Object.keys(c.custom_data).forEach(k => {
                    implicitSet.add(k);
                    if (!exampleValues[k]) exampleValues[k] = c.custom_data[k];
                });
            }
        });
    }
    console.log('Found Implicit Keys:', Array.from(implicitSet));
    console.log('Example Values:', exampleValues);
}

debugFields();
