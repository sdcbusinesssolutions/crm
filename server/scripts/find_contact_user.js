const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findContact() {
    const phoneToFind = '918920800756';

    console.log(`Searching for phone: ${phoneToFind}`);

    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .or(`phone.eq.${phoneToFind},phone.eq.+${phoneToFind},phone.ilike.%${phoneToFind}%`);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.log('No contact found.');
    }
}

findContact();
