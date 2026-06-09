const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const csv = fs.readFileSync('domains.csv', 'utf8');
const line = csv.split('\n')[1]; // cloudospire line
const cols = line.split(',');
const supabaseUrl = cols[5];
const supabaseKey = cols[7]; // Service key

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function debugInboxTags() {
    console.log("Fetching from LIVE cloudospire DB:", supabaseUrl);
    
    // Simulating user_id
    const { data: convs, error: convErr } = await supabaseAdmin
        .from('conversations')
        .select('id, contact_phone, tags, user_id')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (convErr) {
        console.error("Error:", convErr);
        return;
    }

    console.log(`Found ${convs.length} conversations.`);
    const activePhones = convs.map(c => c.contact_phone).filter(Boolean);
    const userId = convs[0]?.user_id;
    console.log("Active Phones:", activePhones);
    console.log("User ID:", userId);

    let contactTagsMap = {};
    if (activePhones.length > 0) {
        const { data: crmContacts, error: crmErr } = await supabaseAdmin
            .from('contacts')
            .select('phone, tags')
            .eq('user_id', userId)
            .in('phone', activePhones);
            
        if (crmErr) console.error("CRM Error:", crmErr);
        
        console.log("CRM Contacts matching phones:", crmContacts);

        if (crmContacts) {
            crmContacts.forEach(c => {
                contactTagsMap[c.phone] = Array.isArray(c.tags) ? c.tags : [];
            });
        }
    }

    console.log("Contact Tags Map:", contactTagsMap);

    const mergedData = convs.map(chat => {
        const chatTags = Array.isArray(chat.tags) ? chat.tags : [];
        const cTags = contactTagsMap[chat.contact_phone] || [];
        
        const combined = [...chatTags];
        for (const tag of cTags) {
            if (!combined.some(t => t.toLowerCase() === tag.toLowerCase())) {
                combined.push(tag);
            }
        }
        
        return {
            phone: chat.contact_phone,
            mergedTags: combined
        };
    });

    console.log("Final UI Merged Data:", mergedData);
}
debugInboxTags();
