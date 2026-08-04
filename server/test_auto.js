const SheetAutomationService = require('./services/SheetAutomationService');
const { supabaseAdmin } = require('./lib/supabaseClient');

async function test() {
    console.log("Triggering...");
    try {
        const res = await SheetAutomationService.triggerById('4a1e4635-4645-402b-8112-a97cfc329c69', '560fe563-3f17-4784-94fd-25af552f1a4f', true);
        console.log("Done:", res);
    } catch(e) {
        console.error("Error:", e);
    }
}

test();
