
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');
const SheetAutomationService = require('../services/SheetAutomationService');

async function forceRun() {
    console.log('--- Forcing Sheet Automation Run (with new code) ---');
    try {
        await SheetAutomationService.processJobs();
        console.log('--- Run Complete ---');
    } catch (e) {
        console.error('Run Failed:', e);
    }
}

forceRun().then(() => process.exit(0));
