const { createClient } = require('@supabase/supabase-js');

// from domains_copy_3.csv for clickube.com / ssckorsnhjhzqxyukexm
const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function checkDatabase() {
    console.log('--- Checking messages containing 8408907516 ---');

    // Check messages
    const { data: messages, error: msgErr } = await supabaseAdmin
        .from('messages')
        .select('*')
        .or('phone_number.ilike.%8408907516%,contact_phone.ilike.%8408907516%,remote_phone.ilike.%8408907516%,to.ilike.%8408907516%,from.ilike.%8408907516%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (msgErr) console.error('Error fetching messages:', msgErr.message);
    else console.log(`Found ${messages.length} messages.`);
    if (messages && messages.length > 0) {
        messages.forEach(m => console.log(`[${m.created_at}] ID: ${m.id} | Flow: ${m.flow_id || 'N/A'}\nContent: ${JSON.stringify(m)}\n`));
    }

    console.log('\n--- Checking flow logs containing 8408907516 ---');

    const { data: logs, error: logErr } = await supabaseAdmin
        .from('flow_execution_logs')
        .select('*')
        .or('contact_phone.ilike.%8408907516%,phone_number.ilike.%8408907516%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (logErr) console.error('Error fetching flow execution logs:', logErr.message);
    else console.log(`Found ${logs ? logs.length : 0} flow logs.`);
    if (logs && logs.length > 0) {
        console.log(JSON.stringify(logs, null, 2));
    }

    // Check whatsapp_config
    console.log('\n--- Checking whatsapp config for 7744903787 ---');
    const { data: configs, error: cfgErr } = await supabaseAdmin
        .from('whatsapp_config')
        .select('*')
        .or('phone_number.ilike.%7744903787%,wid.ilike.%7744903787%');

    if (cfgErr) console.error('Error fetching whatsapp config:', cfgErr.message);
    else console.log(`Found ${configs.length} configs.`);
    if (configs && configs.length > 0) {
        configs.forEach(c => console.log(`User ID: ${c.user_id} | Phone: ${c.phone_number} | Status: ${c.status}`));
    }
}

checkDatabase();
