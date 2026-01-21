const { supabaseAdmin } = require('../lib/supabaseClient');

const AUTOMATION_ID = 'da259972-005d-4f14-9b8e-de4a569762a4'; // Taken from previous logs

async function clearHistory() {
    console.log(`Clearing history for automation: ${AUTOMATION_ID}`);
    const { error } = await supabaseAdmin
        .from('sheet_automation_history')
        .delete()
        .eq('automation_id', AUTOMATION_ID);

    if (error) {
        console.error('Error clearing history:', error);
    } else {
        console.log('History CLEARED. usage of "Trigger Now" should now re-process the row.');
    }
}

// Ensure environment variables are loaded
const path = require('path');
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });

clearHistory();
