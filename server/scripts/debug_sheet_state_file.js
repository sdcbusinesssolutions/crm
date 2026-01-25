
const { supabaseAdmin } = require('../lib/supabaseClient');
const fs = require('fs');
const path = require('path');

async function debugSheetAutomations() {
    let output = '--- Debugging Sheet Automations ---\n';

    try {
        const { data: automations, error } = await supabaseAdmin
            .from('sheet_automations')
            .select('*');

        if (error) {
            output += `Error fetching automations: ${JSON.stringify(error)}\n`;
        } else {
            output += `Found ${automations.length} automations.\n`;

            for (const auto of automations) {
                output += `\nID: ${auto.id}\n`;
                output += `Name: ${auto.name}\n`;
                output += `Status: ${auto.status}\n`;
                output += `Type: ${auto.automation_type}\n`;
                output += `Spreadsheet: ${auto.spreadsheet_id}\n`;
                output += `Sheet Name: ${auto.sheet_name}\n`;
                output += `Last Run: ${auto.last_run_at}\n`;
                output += `Last Processed Index: ${auto.last_processed_row_index}\n`;
                output += `Mapping: ${JSON.stringify(auto.mapping_config)}\n`;
                output += `Error Log: ${auto.error_log}\n`;
            }
        }
    } catch (e) {
        output += `Exception: ${e.message}\n`;
    }

    fs.writeFileSync(path.join(__dirname, 'debug_sheet_output.txt'), output);
    console.log('Debug output written to debug_sheet_output.txt');
}

debugSheetAutomations().catch(e => console.error(e));
