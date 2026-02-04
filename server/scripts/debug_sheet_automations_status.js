const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: './.env' }); // Adjust path if needed

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAutomations() {
    const { data: automations, error } = await supabase
        .from('sheet_automations')
        .select('*');

    if (error) {
        console.error('Error fetching automations:', error);
        return;
    }

    const fs = require('fs');
    const output = [];
    const log = (msg) => {
        console.log(msg);
        output.push(msg);
    };

    log(`Found ${automations.length} automations.`);

    automations.forEach(auto => {
        log('------------------------------------------------');
        log(`ID: ${auto.id}`);
        log(`Name: ${auto.name}`);
        log(`Type: ${auto.automation_type}`);
        log(`Status: ${auto.status}`);
        log(`Schedule Config: ${JSON.stringify(auto.schedule_config, null, 2)}`);
        log(`Last Run (UTC): ${auto.last_run_at}`);

        // Convert Last Run to IST for easier reading
        if (auto.last_run_at) {
            const date = new Date(auto.last_run_at);
            const istDate = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
            log(`Last Run (IST): ${istDate}`);
        }

        log(`Trigger Condition: ${JSON.stringify(auto.trigger_condition, null, 2)}`);
    });

    fs.writeFileSync('debug_automations_output.txt', output.join('\n'));
}

listAutomations();
