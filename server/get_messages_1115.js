const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function check1115Event() {
    console.log('--- Checking messages around 11:15 AM (IST) = 05:45 AM UTC ---');
    console.log('We will check between 05:30 and 06:15 UTC for contact 8408907516');

    // FETCH DIRECTLY TO BYPASS user_id CHECK FOR QUICK LOOK
    const startTimeUtc = new Date('2026-03-02T05:00:00Z').toISOString();
    const endTimeUtc = new Date('2026-03-02T06:30:00Z').toISOString();

    const { data: convos } = await supabaseAdmin.from('conversations').select('id, user_id').ilike('contact_phone', '%8408907516%');
    let convoIds = convos?.map(c => c.id) || [];
    let userId = convos?.[0]?.user_id || null;

    if (convoIds.length > 0) {
        const { data: msgs, error } = await supabaseAdmin.from('messages')
            .select('*')
            .in('conversation_id', convoIds)
            .gte('created_at', startTimeUtc)
            .lte('created_at', endTimeUtc)
            .order('created_at', { ascending: true });

        if (error) console.error(error);
        if (msgs) {
            console.log(`\nTimeline around 11:15 IST (05:45 UTC):`);
            msgs.forEach(m => {
                const date = new Date(m.created_at);
                const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                console.log(`[${istTime} IST | ${m.created_at}] [${m.direction.toUpperCase()}] ID: ${m.id} | Type: ${m.type}`);
                console.log(`  Text: ${m.text || '<no text>'}\n`);
            });
        }
    }

    // Check Flow Execution Logs
    console.log(`\n--- Checking flow_sessions / executions for User ${userId} ---`);
    if (userId) {
        const { data: sessions } = await supabaseAdmin.from('flow_sessions')
            .select('*')
            .ilike('contact_phone', '%8408907516%')
            .gte('created_at', startTimeUtc)
            .lte('created_at', endTimeUtc);

        if (sessions && sessions.length > 0) {
            sessions.forEach(s => {
                const date = new Date(s.created_at);
                const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                console.log(`[Session Started ${istTime} IST | ${date.toISOString()}] ID: ${s.id} | Flow: ${s.flow_id} | Status: ${s.status}`);
            });
        }

        console.log("\n--- Checking webhook_logs ---");
        const { data: logs, error: logsErr } = await supabaseAdmin.from('webhook_logs')
            .select('*')
            .eq('user_id', userId)
            .ilike('sender_phone', '%8408907516%')
            .gte('created_at', startTimeUtc)
            .lte('created_at', endTimeUtc)
            .order('created_at', { ascending: true });

        if (logsErr) {
            console.error("Webhook Logs error:", logsErr.message);
        } else if (logs && logs.length > 0) {
            logs.forEach(l => {
                const date = new Date(l.created_at);
                const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                console.log(`[Webhook ${istTime} IST | ${date.toISOString()}] Method: ${l.http_method} | Status: ${l.processed_status} | Error: ${l.error_message}`);
            });
        }
    }
}

check1115Event();
