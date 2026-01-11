const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debug() {
    const conversationId = 'dacf7964-225d-45d6-9e9c-05a07e150a96';

    console.log(`Checking count for ${conversationId}...`);

    const { count, error } = await supabaseAdmin
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

    if (error) {
        console.error("Error:", error);
    } else {
        console.log(`Total Messages Count: ${count}`);
    }

    // Also check the NEWEST message
    const { data: newest } = await supabaseAdmin
        .from('messages')
        .select('id, text, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(1);

    if (newest && newest.length > 0) {
        console.log("Newest Message in DB:", newest[0]);
    }
}

debug();
