const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log('\n--- Finding Conversations ---');
    const { data: convos, error: convoErr } = await supabaseAdmin.from('conversations').select('*').limit(1);
    if (convoErr) console.error("Conversations error", convoErr.message);
    else if (convos && convos.length > 0) {
        console.log("Conversations columns:", Object.keys(convos[0]).join(', '));
    }

    console.log('\n--- Finding Conversation for 8408907516 ---');
    // From codebase we might know how conversations are linked. Usually contact_id or something similar.
    const contactIds = [
        "7d6551ba-bda3-4e93-bb8d-563a90f62263",
        "6bfc8350-a8c3-4b81-b6b6-1f2e7448ea2f"
    ]; // The most recently active ones.

    const { data: myConvos } = await supabaseAdmin.from('conversations').select('*').in('contact_id', contactIds);
    let convoIds = myConvos?.map(c => c.id) || [];

    if (convoIds.length > 0) {
        console.log(`\n--- Finding Messages for Conversation IDs: ${convoIds.join(', ')} ---`);
        const { data: msgs, error: msgsErr } = await supabaseAdmin.from('messages')
            .select('*')
            .in('conversation_id', convoIds)
            .order('created_at', { ascending: false })
            .limit(20);

        if (msgsErr) console.error("Messages error:", msgsErr.message);
        console.log(`Found ${msgs ? msgs.length : 0} messages.`);
        if (msgs) {
            msgs.forEach(m => console.log(`[${m.created_at}] Dir: ${m.direction} | Text: ${m.text}`));
        }
    } else {
        console.log("No conversations found for those recent contact IDs. Let's try fetching latest 20 messages overall to see what it looks like.");
        const { data: allMsgs } = await supabaseAdmin.from('messages').select('*').order('created_at', { ascending: false }).limit(5);
        console.log(JSON.stringify(allMsgs, null, 2));
    }
}

run();
