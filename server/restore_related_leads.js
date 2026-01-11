
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreRelatedLeads() {
    console.log('--- RESTORE RELATED LEADS ---');

    // 1. Resolve Users
    const { data: { users } } = await supabase.auth.admin.listUsers();

    // Target: kd31967
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // Source: user1.compnet
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    // 2. We already moved Contacts to U1.
    // Leads are often linked to Contacts via 'contact_id' or 'phone' or just a name match.
    // We need to find leads in U3's account that match the Contacts now owned by U1.

    // Get U1's new contacts
    const { data: u1Contacts } = await supabase
        .from('contacts')
        .select('id, phone, name')
        .eq('user_id', u1.id);

    console.log(`User 1 now has ${u1Contacts.length} contacts.`);

    if (u1Contacts.length === 0) {
        console.log('No contacts found for U1 to match leads against.');
        return;
    }

    const contactIds = u1Contacts.map(c => c.id);

    // 3. Find Leads owned by U3 that reference these contact_ids
    // Note: 'leads' table schema usually has 'contact_id'.
    // Let's verify field name first? Assuming 'contact_id'.

    // Note: Some systems link by phone. Let's try finding orphans.

    // Filter leads where contact_id IN contactIds AND user_id = U3
    // But table might not have contact_id. It might have phone.

    // Let's try simple match first: All leads that correspond to valid contacts of U1
    // Wait, if leads are separate entities in your CRM, they might not be linked.
    // But usually a Lead corresponds to a Contact.

    // WARNING: If leads table doesn't have contact_id, we might rely on phone.

    // Let's assume leads might NOT be strictly linked but if they are pipeline items.
    // Generally pipeline items ARE leads.

    // If I moved the contacts, I should move the corresponding leads too.
    // How to find them?
    // Maybe matching phone number?

    const phones = u1Contacts.map(c => c.phone).filter(p => p);

    console.log(`Searching for leads with matching phones (${phones.length} phones)...`);

    const { data: leads, error: lError } = await supabase
        .from('leads')
        .select('id, name, phone')
        .eq('user_id', u3.id)
        .in('phone', phones);

    if (lError) {
        console.error('Error searching leads:', lError);
        return;
    }

    console.log(`Found ${leads.length} matching leads.`);

    if (leads.length > 0) {
        const leadIds = leads.map(l => l.id);

        const { error: mError } = await supabase
            .from('leads')
            .update({ user_id: u1.id })
            .in('id', leadIds);

        if (mError) console.error('Error moving leads:', mError);
        else console.log('Leads moved to User 1.');
    }

    console.log('--- LEADS RESTORE COMPLETE ---');
}

restoreRelatedLeads();
