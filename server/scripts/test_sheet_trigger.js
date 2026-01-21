// Ensure environment variables are loaded FIRST
const path = require('path');
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

const { supabaseAdmin } = require('../lib/supabaseClient');
const SheetAutomationService = require('../services/SheetAutomationService');
const USER_ID = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';

async function runTest() {
    console.log('--- STARTING SHEET TRIGGER TEST ---');

    console.log('ENV CHECK:', {
        URL: process.env.SUPABASE_URL,
        ServiceKeyLength: process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.length : 0
    });
    const { data: automations, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*')
        .eq('user_id', USER_ID);

    if (error) {
        console.error('Error fetching automations:', error);
        return;
    }

    if (!automations || automations.length === 0) {
        console.log('No automations found for this user. Fetching ANY automation to verify DB connection...');
        const { data: allAuto, error: allError } = await supabaseAdmin
            .from('sheet_automations').select('*').limit(5);

        console.log('Sample Automations:', allAuto);
        if (allError) console.error('Error fetching sample:', allError);
        return;
    }

    console.log(`Found ${automations.length} automations.`);

    // Pick the first active one, or specific one
    const auto = automations[0];
    console.log(`2. Triggering Automation: ${auto.name} (ID: ${auto.id})`);
    console.log(`   Spreadsheet ID: ${auto.spreadsheet_id}`);
    console.log(`   Sheet Name: ${auto.sheet_name}`);

    // CHECK HISTORY COUNT
    const { count, error: countErr } = await supabaseAdmin
        .from('sheet_automation_history')
        .select('*', { count: 'exact', head: true })
        .eq('automation_id', auto.id);

    console.log(`   HISTORY PRE-CHECK: Found ${count} history records for this automation.`);
    if (countErr) console.error('   History check error:', countErr);

    try {
        const result = await SheetAutomationService.executeJob(auto, true); // true = manual run
        console.log('--- EXECUTION RESULT ---');
        console.log(JSON.stringify(result, null, 2));
        console.log('--- TEST COMPLETED SUCCESSFULLY ---');
    } catch (err) {
        console.error('--- EXECUTION FAILED ---');
        console.error(err);
    }
}

// Note: path might need adjustment depending on where we run it from. 
// Usually root is assumed if we run `node server/scripts/...` but dotenv path needs to be correct.
// Let's assume standard execution from project root or `server/` dir.

runTest();
// Note: path might need adjustment depending on where we run it from.
// Usually root is assumed if we run `node server/scripts/...` but dotenv path needs to be correct.
// Let's assume standard execution from project root or `server/` dir.

// End of script
