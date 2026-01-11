const { supabaseAdmin } = require('../lib/supabaseClient');

async function deduplicateConversations() {
    console.log('--- Deduplicating Conversations ---');

    // 1. Get all conversations
    const { data: allConvs, error } = await supabaseAdmin
        .from('conversations')
        .select('*');

    if (error) {
        console.error('Error fetching conversations:', error);
        return;
    }

    // 2. Group by phone
    const groups = {};
    allConvs.forEach(c => {
        const phone = c.contact_phone; // Assumes clean phone numbers already
        if (!groups[phone]) groups[phone] = [];
        groups[phone].push(c);
    });

    // 3. Process duplicates
    for (const phone in groups) {
        const convs = groups[phone];
        if (convs.length > 1) {
            console.log(`Found ${convs.length} conversations for ${phone}`);

            // Sort by created_at (keep oldest), or just pick index 0
            // Assuming we keep the first one found as 'Original'
            const primary = convs[0];
            const duplicates = convs.slice(1);
            const duplicateIds = duplicates.map(d => d.id);

            // A. Move Messages
            const { error: moveMsgError } = await supabaseAdmin
                .from('messages')
                .update({ conversation_id: primary.id })
                .in('conversation_id', duplicateIds);

            if (moveMsgError) {
                console.error(`Failed to move messages for ${phone}:`, moveMsgError);
                continue;
            }
            console.log(`Moved messages to conversation ${primary.id}`);

            // B. Delete Duplicate Conversations
            const { error: delError } = await supabaseAdmin
                .from('conversations')
                .delete()
                .in('id', duplicateIds);

            if (delError) {
                console.error(`Failed to delete duplicate conversations for ${phone}:`, delError);
            } else {
                console.log(`Deleted ${duplicateIds.length} duplicate conversations.`);
            }
        }
    }
}

async function deduplicateContacts() {
    console.log('\n--- Deduplicating Contacts ---');

    // 1. Get all contacts
    const { data: allContacts, error } = await supabaseAdmin
        .from('contacts')
        .select('*');

    if (error) {
        console.error('Error fetching contacts:', error);
        return;
    }

    // 2. Group by phone
    const groups = {};
    allContacts.forEach(c => {
        const phone = c.phone;
        if (!groups[phone]) groups[phone] = [];
        groups[phone].push(c);
    });

    // 3. Process duplicates
    for (const phone in groups) {
        const contacts = groups[phone];
        if (contacts.length > 1) {
            console.log(`Found ${contacts.length} duplicate contacts for ${phone}`);

            // Keep the one with the most data or just oldest?
            // Let's keep the first one
            const primary = contacts[0];
            const duplicates = contacts.slice(1);
            const duplicateIds = duplicates.map(d => d.id);

            // A. Relink Campaign Queue items (FK Blocking Deletion)
            // Update items pointing to duplicated contacts to point to the primary contact
            const { error: relinkError } = await supabaseAdmin
                .from('campaign_queue')
                .update({ contact_id: primary.id })
                .in('contact_id', duplicateIds);

            if (relinkError) {
                console.error(`Failed to relink campaign_queue for ${phone}:`, relinkError);
                continue; // Skip deletion if we can't safely relink
            }
            if (duplicateIds.length > 0) console.log(`Relinked campaign_queue items to contact ${primary.id}`);

            // Delete Duplicates
            const { error: delError } = await supabaseAdmin
                .from('contacts')
                .delete()
                .in('id', duplicateIds);

            if (delError) {
                console.error(`Failed to delete duplicate contacts for ${phone}:`, delError);
            } else {
                console.log(`Deleted ${duplicateIds.length} duplicate contacts.`);
            }
        }
    }
}

async function run() {
    await deduplicateConversations();
    await deduplicateContacts();
    console.log('\n✅ Deduplication Complete!');
}

run();
