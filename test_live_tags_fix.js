const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const csv = fs.readFileSync('../domains.csv', 'utf8');
const line = csv.split('\n')[1]; // cloudospire line
const cols = line.split(',');
const supabaseUrl = cols[5];
const supabaseKey = cols[7]; // Service key

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function debugInboxTags() {
    console.log("Fetching from LIVE DB:", supabaseUrl);
    
    // Find the user ID based on phone 9373393645
    const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, contact_phone, tags, user_id')
        .eq('contact_phone', '9373393645')
        .limit(1);

    if (convErr || convs.length === 0) {
        console.error("Error or no conv:", convErr);
        return;
    }

    const userId = convs[0].user_id;
    console.log("Found Conversation for 9373393645. User ID:", userId);
    console.log("Conversation Tags:", convs[0].tags);

    const { data: crmContacts, error: crmErr } = await supabaseAdmin
        .from('contacts')
        .select('phone, tags')
        .eq('user_id', userId)
        .eq('phone', '9373393645');
        
    console.log("CRM Contacts match:", crmContacts);
}
debugInboxTags();
