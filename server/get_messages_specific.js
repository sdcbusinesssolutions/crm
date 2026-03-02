const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function run() {
    console.log('--- Configs ---');
    const { data: configs } = await supabaseAdmin.from('whatsapp_config').select('*').ilike('phone_number', '%7744903787%');
    console.log(JSON.stringify(configs, null, 2));

    let user_id = null;
    if (configs && configs.length > 0) {
        user_id = configs[0].user_id;
    }

    console.log(`\n--- Conversations for User ID: ${user_id} and Phone: 8408907516 ---`);
    let query = supabaseAdmin.from('conversations').select('*').ilike('contact_phone', '%8408907516%');

    // We can also just fetch all to be safe without user filtering.
    const { data: convos, error: convoErr } = await query;
    if (convoErr) console.error("Conversations Error:", convoErr);
    else {
        console.log(`Found ${convos.length} conversations.`);

        let convoIds = convos.map(c => c.id);
        if (convoIds.length > 0) {
            console.log('\n--- Messages ---');
            const { data: msgs, error: msgErr } = await supabaseAdmin
                .from('messages')
                .select('*')
                .in('conversation_id', convoIds)
                .order('created_at', { ascending: false });

            if (msgErr) console.error("Messages Error:", msgErr);
            else {
                console.log(`Found ${msgs.length} messages.`);
                msgs.forEach(m => console.log(`[${m.created_at}] Dir: ${m.direction} | Text: ${m.text || m.id}`));

                // Print detailed view of the messages from the flow engine (where type might be something specific)
                console.log("\nRecent details:");
                console.log(JSON.stringify(msgs.slice(0, 5), null, 2));
            }
        }
    }
}

run();
