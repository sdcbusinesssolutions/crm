const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function check1115Trigger() {
    console.log("Looking for incoming message 'water' around 11:15 IST (05:45 UTC)");
    const phone = '%8408907516%';
    const startTimeUtc = new Date('2026-03-02T05:30:00Z').toISOString();
    const endTimeUtc = new Date('2026-03-02T06:00:00Z').toISOString();

    const { data: convos } = await supabaseAdmin.from('conversations').select('id, user_id').ilike('contact_phone', phone);
    let convoIds = convos?.map(c => c.id) || [];

    if (convoIds.length > 0) {
        const { data: msgs, error } = await supabaseAdmin.from('messages')
            .select('*')
            .in('conversation_id', convoIds)
            .gte('created_at', startTimeUtc)
            .lte('created_at', endTimeUtc)
            .order('created_at', { ascending: true });

        if (msgs) {
            msgs.forEach(m => {
                const date = new Date(m.created_at);
                const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                console.log(`[${istTime} IST] [${m.direction.toUpperCase()}] Text: ${m.text || '<no text>'}`);
            });
        }
    }
}

check1115Trigger();
