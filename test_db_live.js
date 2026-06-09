const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debugInboxTags() {
    console.log("Fetching conversations to see what tags are returned...");
    const { data, error } = await supabaseAdmin
        .from('conversations')
        .select(`
            id,
            contact_phone,
            tags,
            contact:contacts!contact_phone(
                id,
                name,
                phone,
                tags,
                color
            )
        `)
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${data.length} conversations.`);
    data.forEach(chat => {
        console.log(`\nPhone: ${chat.contact_phone}`);
        console.log(`Conversations table tags:`, chat.tags);
        console.log(`Contacts table (joined) tags:`, Array.isArray(chat.contact) ? (chat.contact[0]?.tags || chat.contact.map(c => c.tags)) : chat.contact?.tags);
        
        // Simulating the merge logic
        const chatTags = Array.isArray(chat.tags) ? chat.tags : [];
        const contactObj = Array.isArray(chat.contact) ? chat.contact[0] : chat.contact;
        const contactTags = Array.isArray(contactObj?.tags) ? contactObj.tags : [];
        
        const combined = [...chatTags];
        for (const tag of contactTags) {
            if (!combined.some(t => t.toLowerCase() === tag.toLowerCase())) {
                combined.push(tag);
            }
        }
        console.log(`MERGED tags that WOULD be sent to UI:`, combined);
    });
}
debugInboxTags();
