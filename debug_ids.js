const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debug() {
    // Force simple ASCII logging
    const { data: convs } = await supabaseAdmin.from('conversations').select('id, contact_phone, created_at').order('updated_at', { ascending: false }).limit(2);
    if (convs) {
        console.log("CONVS:");
        convs.forEach(c => console.log(c.id + " " + c.contact_phone));
    }

    const { data: msgs } = await supabaseAdmin.from('messages').select('id, conversation_id, type, created_at').order('created_at', { ascending: false }).limit(5);
    if (msgs) {
        console.log("MSGS:");
        msgs.forEach(m => console.log(m.id + " " + m.conversation_id + " " + m.type));
    }
}
debug();
