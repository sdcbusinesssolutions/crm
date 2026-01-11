
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkMigrationStart() {
    console.log('--- MIGRATION CHECK ---');

    // 1. Get Users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    if (!u1 || !u2) {
        console.log('Users not found');
        return;
    }

    console.log(`U1 (kd31967) Created: ${u1.created_at}`);
    console.log(`U2 (online) Created: ${u2.created_at}`);

    const u1Date = new Date(u1.created_at);

    // 2. Count U1 contacts older than account
    const { data: contacts } = await supabase
        .from('contacts')
        .select('id, created_at')
        .eq('user_id', u1.id);

    let olderCount = 0;
    (contacts || []).forEach(c => {
        const cDate = new Date(c.created_at);
        if (cDate < u1Date) {
            olderCount++;
        }
    });

    console.log(`Total U1 Contacts: ${(contacts || []).length}`);
    console.log(`Contacts OLDER than U1 account: ${olderCount}`);

    if (olderCount > 0) {
        console.log(`Recommendation: Move ${olderCount} contacts to U2 (${u2.email})`);
    } else {
        console.log('No older contacts found. Maybe U1 is older than I thought?');
    }
}

checkMigrationStart();
