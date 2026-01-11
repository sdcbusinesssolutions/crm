const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debug() {
    const conversationId = 'dacf7964-225d-45d6-9e9c-05a07e150a96';
    const { count } = await supabaseAdmin.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', conversationId);
    console.log("COUNT: " + count);

    // Newest ID
    const { data } = await supabaseAdmin.from('messages').select('id').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(1);
    if (data) console.log("NEWEST ID: " + data[0].id);
}
debug();
