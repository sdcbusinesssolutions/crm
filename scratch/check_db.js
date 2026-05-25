const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function checkTables() {
    try {
        // Check Leads
        const { data: leads } = await supabaseAdmin.from('leads').select('*').limit(1);
        if (leads && leads.length > 0) console.log('Lead keys:', Object.keys(leads[0]));
        
        // Check Contacts
        const { data: contacts } = await supabaseAdmin.from('contacts').select('*').limit(1);
        if (contacts && contacts.length > 0) console.log('Contact keys:', Object.keys(contacts[0]));

        // Check Conversations
        const { data: conversations } = await supabaseAdmin.from('conversations').select('*').limit(1);
        if (conversations && conversations.length > 0) console.log('Conversation keys:', Object.keys(conversations[0]));

    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkTables();
