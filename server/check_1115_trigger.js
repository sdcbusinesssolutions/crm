const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function check1115Trigger() {
    // We see that at 11:15 IST (05:45:06 UTC) a session was created for flow_id 1d155d50-eddf-4ea1-8e5a-339f534d5210
    const flowId = '1d155d50-eddf-4ea1-8e5a-339f534d5210';
    console.log(`--- Checking Flow ${flowId} Details ---`);

    // Check Flow Data
    const { data: flows } = await supabaseAdmin.from('flows').select('*').eq('id', flowId);
    if (flows && flows.length > 0) {
        const flow = flows[0];
        console.log(`Flow Name: ${flow.name}`);
        console.log(`Flow Status: ${flow.status}`);

        // Find triggers
        const triggerNodes = flow.nodes.filter(n => ['onMessage', 'trigger', 'sheetTrigger', 'pipelineTrigger', 'taskReminder'].includes(n.type));
        console.log("\nTrigger Nodes in this Flow:");
        triggerNodes.forEach(n => {
            console.log(`  Type: ${n.type} | Data:`, JSON.stringify(n.data));
        });
    } else {
        console.log(`Could not find flow ${flowId} in DB.`);
    }

    // Since the flow was started, what could have triggered it without an inbound message?
    // 1. A campaign? Let's check campaign_queue or campaigns around that time.
    console.log("\n--- Checking campaign deliveries around 11:15 IST ---");
    const startTimeUtc = new Date('2026-03-02T05:30:00Z').toISOString();
    const endTimeUtc = new Date('2026-03-02T06:00:00Z').toISOString();

    // Is there a campaign queue entry for this user at this exact time?
    const { data: queue } = await supabaseAdmin.from('campaign_queue')
        .select('*, campaigns(title)')
        .ilike('phone_number', '%8408907516%')
        .gte('created_at', startTimeUtc)
        .lte('created_at', endTimeUtc);

    if (queue && queue.length > 0) {
        console.log(`Found campaign queue processing for this number!`);
        queue.forEach(q => {
            const date = new Date(q.created_at);
            const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
            console.log(`[${istTime} IST] Queue ID: ${q.id} | Campaign: ${q.campaigns?.title} | Status: ${q.status}`);
        });
    } else {
        console.log("No campaign queue entries found for this phone number at that time.");
    }

    // 2. An API/Webhook trigger explicitly hitting start_flow API?
    console.log("\n--- Check Webhook Logs around 11:15 IST for User 486e3bc4-2b6b-4185-bee2-1bfb6ab3f829---");
    const { data: weblogs } = await supabaseAdmin.from('webhook_logs')
        .select('*')
        .eq('user_id', '486e3bc4-2b6b-4185-bee2-1bfb6ab3f829')
        .gte('created_at', startTimeUtc)
        .lte('created_at', endTimeUtc);

    if (weblogs && weblogs.length > 0) {
        weblogs.forEach(l => {
            const date = new Date(l.created_at);
            const istTime = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
            console.log(`[${istTime}] Method: ${l.http_method} | Sender: ${l.sender_phone} | Type: ${l.message_type}`);
        });
    }

    // 3. Drip campaign / Follow Up Processor?
    console.log("\n--- Check API/Logs for external automation logs ---");
    const { data: extLogs, error: extErr } = await supabaseAdmin.from('sheet_automation_logs')
        .select('*')
        .ilike('contact_phone', '%8408907516%')
        .gte('executed_at', startTimeUtc)
        .lte('executed_at', endTimeUtc);

    if (extLogs && extLogs.length > 0) {
        console.log(`Found Spreadsheet Automation!`);
        extLogs.forEach(l => console.log(`[${l.executed_at}] Action: ${l.action_taken}`));
    }
}

check1115Trigger();
