
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function findContact() {
    const searchPhone = '0000000000';
    console.log(`Searching for phone ending in: ${searchPhone.slice(-6)}`);
    
    // Search with ilike to handle country codes, etc.
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .ilike('phone', `%${searchPhone}%`);
    
    if (error) {
        console.error('Error:', error.message);
        return;
    }

    if (contacts && contacts.length > 0) {
        console.log(`✅ Found ${contacts.length} matching contact(s):`);
        contacts.forEach(c => console.log(`- ID: ${c.id} | Phone: ${c.phone} | Name: ${c.name}`));
    } else {
        console.log('❌ No contacts found with that number at all.');
        
        // Let's list the 5 most recently created/updated contacts to see what's happening
        const { data: recent } = await supabase.from('contacts').select('id, phone, name, updated_at').order('updated_at', { ascending: false }).limit(5);
        console.log('\nLast 5 recently updated contacts:');
        recent.forEach(r => console.log(`- Phone: ${r.phone} | Name: ${r.name} | Updated: ${r.updated_at}`));
    }
}
findContact();
