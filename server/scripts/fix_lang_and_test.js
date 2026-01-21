require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');
const SheetAutomationService = require('../services/SheetAutomationService');

async function fixAndRun() {
    console.log('--- FIXING LANGUAGE AND TESTING ---');

    // 1. Find the automation with 'uti' template
    const { data: automations, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*');

    if (error) { console.error('Fetch error:', error); return; }

    const auto = automations.find(a => a.template_config?.template_name === 'uti');

    if (!auto) {
        console.log('No automation found with template name "uti".');
        return;
    }

    console.log(`Found automation: ${auto.name} (ID: ${auto.id})`);

    // 2. FORCE UPDATE Config
    const newConfig = {
        ...auto.template_config,
        language: 'en_US',
        components: [
            { type: 'BODY', text: 'Placeholder {{1}} text {{2}}' }
        ]
    };

    console.log('Updating config to inject en_US and components...');
    const { error: updateError } = await supabaseAdmin
        .from('sheet_automations')
        .update({ template_config: newConfig })
        .eq('id', auto.id);

    if (updateError) { console.error('Update error:', updateError); return; }
    console.log('Update Successful.');

    // Update local object for execution
    auto.template_config = newConfig;

    // 3. Execute Job (Manual Trigger)
    console.log('--- EXECUTING TRIGGER ---');
    try {
        const result = await SheetAutomationService.executeJob(auto, true);
        console.log('Result:', result);
    } catch (e) {
        console.error('Execution Failed:', e.message);
    }
}

fixAndRun();
