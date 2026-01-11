const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debug() {
    console.log("--- CONVERSATIONS ---");
    const { data: convs } = await supabaseAdmin.from('conversations').select('id, contact_phone, last_message').order('updated_at', { ascending: false }).limit(3);
    convs.forEach(c => console.log(`C: ${c.id} | ${c.contact_phone} | ${c.last_message?.substring(0, 20)}`));

    console.log("--- MESSAGES ---");
    const { data: msgs } = await supabaseAdmin.from('messages').select('id, conversation_id, type, media_url, text').order('created_at', { ascending: false }).limit(5);
    msgs.forEach(m => console.log(`M: ${m.id} | ${m.conversation_id} | ${m.type} | URL: ${m.media_url ? 'YES' : 'NO'} | ${m.text?.substring(0, 20)}`));
}

debug();
