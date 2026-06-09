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
    
    const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, contact_phone, tags, user_id')
        .order('updated_at', { ascending: false })
        .limit(3);

    if (convErr || convs.length === 0) {
        console.error("Error or no conv:", convErr);
        return;
    }

    const userId = convs[0].user_id;
    console.log("Top Conversations:", convs);
    
    const phones = convs.map(c => c.contact_phone).filter(Boolean);

    const { data: crmContacts, error: crmErr } = await supabaseAdmin
        .from('contacts')
        .select('phone, tags')
        .eq('user_id', userId)
        .in('phone', phones);
        
    console.log("CRM Contacts match:", crmContacts);
}
debugInboxTags();
