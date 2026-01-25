
const { supabaseAdmin } = require('../lib/supabaseClient');

async function debugSheetAutomations() {
    console.log('--- Debugging Sheet Automations ---');

    // 1. List all automations
    const { data: automations, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*');

    if (error) {
        console.error('Error fetching automations:', error);
        return;
    }

    console.log(`Found ${automations.length} automations.`);

    for (const auto of automations) {
        console.log(`\nID: ${auto.id}`);
        console.log(`Name: ${auto.name}`);
        console.log(`Status: ${auto.status}`);
        console.log(`Type: ${auto.automation_type}`);
        console.log(`Spreadsheet: ${auto.spreadsheet_id}`);
        console.log(`Sheet Name: ${auto.sheet_name}`);
        console.log(`Last Run: ${auto.last_run_at}`);
        console.log(`Last Processed Index: ${auto.last_processed_row_index}`);
        console.log(`Mapping:`, auto.mapping_config);
        console.log(`Error Log:`, auto.error_log);
    }

    if (automations.length > 0) {
        const auto = automations[0];
        console.log('\n--- Testing Connection for First Automation ---');
        // Fetch integration
        const { data: integration } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('id', auto.connection_id)
            .single();

        if (!integration) {
            console.log('Integration not found!');
        } else {
            console.log('Integration found:', integration.connection_name);
            console.log('Credentials present:', !!integration.credentials);
        }
    }
}

debugSheetAutomations().catch(console.error);
