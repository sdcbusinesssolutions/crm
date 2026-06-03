const DripTriggerService = require('../services/DripTriggerService');
const { supabaseAdmin } = require('../lib/supabaseClient');

async function test() {
    // Just verify the query structure works against the real supabase SDK
    const userId = '1dd0acd9-090a-4c64-896e-4db51c775902';
    const addedTags = ['test-tag'];
    
    try {
        let { data: campaigns, error } = await supabaseAdmin
            .from('drip_campaigns')
            .select('id, name, allow_reentry, trigger_value')
            .eq('user_id', userId)
            .eq('status', 'ACTIVE')
            .eq('trigger_type', 'TAG_ADDED')
            .in('trigger_value', addedTags);
            
        console.log("Query success!", campaigns, error);
    } catch(e) {
        console.error("Query failed!", e);
    }
}
test();
