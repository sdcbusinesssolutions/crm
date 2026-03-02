const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function check1115Trigger() {
    const phone = '%8408907516%';
    const startTimeUtc = new Date('2026-03-02T05:30:00Z').toISOString();
    const endTimeUtc = new Date('2026-03-02T06:00:00Z').toISOString();

    console.log("--- Checking Drip Operations (drip_campaign_contacts) ---");
    const { data: drips } = await supabaseAdmin.from('drip_campaign_contacts')
        .select('*')
        .ilike('contact_phone', phone)
        .gte('created_at', startTimeUtc)
        .lte('created_at', endTimeUtc);

    if (drips && drips.length > 0) {
        drips.forEach(d => console.log(`[${d.created_at}] Drip ID: ${d.id} | Campaign: ${d.drip_campaign_id}`));
    } else {
        console.log("No drip_campaign_contacts found created at this time.");
        // Try looking for existing entries that were *updated* or their execution is tracked somewhere else.
    }

    // Is it possible an API endpoint / webhook (third party) triggered the flow explicitly?
    // /api/flows/:userId/trigger
    console.log("\n--- Let's look at all rows in flow_sessions around 11:15 to find the trigger source (if any) ---");
    const { data: sessionData } = await supabaseAdmin.from('flow_sessions')
        .select('id, flow_id, variables, created_at, status')
        .ilike('contact_phone', phone)
        .gte('created_at', startTimeUtc)
        .lte('created_at', endTimeUtc);

    if (sessionData && sessionData.length > 0) {
        const sess = sessionData[0];
        console.log(`Session ${sess.id} variables:`, Object.keys(sess.variables || {}));
        const trigger = sess.variables?.trigger || {};
        console.log(`Session Trigger Data:`, JSON.stringify(trigger, null, 2));
    }
}

check1115Trigger();
