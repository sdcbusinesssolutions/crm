const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

// Mock req.user for testing - we need the user ID.
// Based on previous logs or context, we might not have it easily without a real request.
// However, we can try to find a user or just query all contacts if RLS allows (admin).
// The user ID was implied in previous interactions. Let's try to query *all* contacts verify count.

const supabaseUrl = process.env.SUPABASE_URL;
// Try service key first for admin access, then anon key.
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars. URL:", !!supabaseUrl, "Key:", !!supabaseKey);
    console.log("Env path:", path.join(__dirname, '../.env'));
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const fs = require('fs');

async function testLimits() {
    let log = "Testing Supabase Limits...\n";
    const logIt = (msg) => { console.log(msg); log += msg + "\n"; };

    try {
        // 1. Check total count without range
        const { count, error: countErr } = await supabase
            .from('contacts')
            .select('*', { count: 'exact', head: true });

        if (countErr) logIt("Count Error: " + JSON.stringify(countErr));
        logIt(`Total Real Count in DB: ${count}`);

        // 2. Fetch with default limit
        const { data: defaultData } = await supabase
            .from('contacts')
            .select('id');
        logIt(`Default Fetch Count: ${defaultData?.length}`);

        // 3. Fetch with Range 0-9999
        const { data: rangeData, error: rangeError } = await supabase
            .from('contacts')
            .select('id')
            .range(0, 9999);

        if (rangeError) logIt("Range Error: " + JSON.stringify(rangeError));
        logIt(`Range(0, 9999) Fetch Count: ${rangeData?.length}`);

        // 4. Check Group Counts
        const { data: groups } = await supabase.from('contact_groups').select('id, name');
        logIt(`Groups found: ${groups?.length}`);

        if (groups) {
            for (const g of groups) {
                const { count } = await supabase
                    .from('contacts')
                    .select('id', { count: 'exact', head: true })
                    .contains('group_ids', [g.id]);

                // Also try fetching with range logic to emulate server
                const { data: contactsInGroup } = await supabase
                    .from('contacts')
                    .select('id')
                    .contains('group_ids', [g.id])
                    .range(0, 9999);

                logIt(`Group '${g.name}' (Count Exact): ${count}, (Range 0-9999): ${contactsInGroup?.length}`);
            }
        }

    } catch (e) {
        logIt("Script Error: " + e);
    }
    fs.writeFileSync('debug_output.txt', log);
}

testLimits();
