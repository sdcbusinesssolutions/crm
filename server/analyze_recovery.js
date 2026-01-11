
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function analyzeUser3Data() {
    console.log('--- ANALYZE USER 3 DATA ---');

    // Get timestamps
    const { data: { users } } = await supabase.auth.admin.listUsers();

    // U1 = kd31967 
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // U3 = user1.compnet
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    const u1Created = new Date(u1.created_at);
    console.log(`User 1 Created: ${u1Created.toISOString()}`);
    console.log(`User 3 Created: ${u3.created_at}`);

    // Check contacts owned by U3 that were created AFTER U1 account
    // These are candidates for belonging to U1
    const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, name, created_at')
        .eq('user_id', u3.id);

    if (error) { console.error(error); return; }

    let probableUser1Contacts = 0;
    let oldContacts = 0;

    // We can also check specifically for contacts created VERY recently (like in the last few days of testing)
    // or just generally after U1 account creation.

    const recentCutoff = new Date('2025-12-01'); // Arbitrary recent date

    const sampleRecent = [];

    contacts.forEach(c => {
        const cDate = new Date(c.created_at);
        if (cDate > u1Created) {
            probableUser1Contacts++;
            if (sampleRecent.length < 5) sampleRecent.push(`${c.name} (${c.created_at})`);
        } else {
            oldContacts++;
        }
    });

    console.log(`Total U3 Contacts: ${contacts.length}`);
    console.log(`Contacts OLDER than U1 (Legacy): ${oldContacts}`);
    console.log(`Contacts NEWER than U1 (Likely U1's): ${probableUser1Contacts}`);

    if (sampleRecent.length > 0) {
        console.log('Sample NEWER contacts:');
        sampleRecent.forEach(s => console.log(`- ${s}`));
    }
}

analyzeUser3Data();
