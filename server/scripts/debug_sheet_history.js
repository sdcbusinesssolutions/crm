const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // Correct key name

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkHistory() {
    // Check for today (IST is UTC+5:30)
    // 2026-02-04 00:00:00 IST is 2026-02-03 18:30:00 UTC
    // 2026-02-05 00:00:00 IST is 2026-02-04 18:30:00 UTC

    // Simplification: just check last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: history, error } = await supabase
        .from('sheet_automation_history')
        .select('*')
        .gte('sent_at', since)
        .order('sent_at', { ascending: false });

    if (error) {
        console.error('Error fetching history:', error);
        return;
    }

    const fs = require('fs');
    const output = [];
    const log = (msg) => {
        console.log(msg);
        output.push(msg);
    };

    log(`Found ${history.length} history entries in last 24h.`);

    history.forEach(h => {
        log(`[${h.sent_at}] AutoID: ${h.automation_id} | Status: ${h.status} | Phone: ${h.phone_number}`);
        if (h.status === 'failed') {
            log(`   Error: ${JSON.stringify(h.meta?.error)}`);
        }
    });

    fs.writeFileSync('debug_sheet_history_out_v2.txt', output.join('\n'));
}

checkHistory();
