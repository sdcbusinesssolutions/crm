const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function check1115Trigger() {
    const startTimeUtc = new Date('2026-03-02T05:40:00Z').toISOString();
    const endTimeUtc = new Date('2026-03-02T05:50:00Z').toISOString();

    console.log("Looking for any events that might have injected 'water' text into flow engine at 11:15 IST (05:45 UTC)..");

    // Look at Webhook logs again across the ENTIRE system for "water" payload around this time.
    const { data: weblogs } = await supabaseAdmin.from('webhook_logs')
        .select('*')
        .gte('created_at', startTimeUtc)
        .lte('created_at', endTimeUtc);

    let foundWater = false;
    if (weblogs) {
        weblogs.forEach(l => {
            const payloadStr = JSON.stringify(l.raw_payload || {}).toLowerCase();
            const contentStr = JSON.stringify(l.extracted_content || {}).toLowerCase();
            const isRelevantPhone = payloadStr.includes('8408907516');

            if (payloadStr.includes('water') || contentStr.includes('water')) {
                foundWater = true;
                const istTime = new Date(l.created_at).toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
                console.log(`[${istTime}] Found 'water' in Webhook Log ${l.id} | Sender: ${l.sender_phone} | TargetPhone: ${isRelevantPhone}`);
                if (isRelevantPhone) {
                    console.log("Payload:", JSON.stringify(l.extracted_content || l.raw_payload, null, 2));
                }
            }
        });
    }

    if (!foundWater) {
        console.log("No webhook received containing 'water'. Could this be a scheduled task or an API call from Drip processor that simulated keyword?");
    }

}

check1115Trigger();
