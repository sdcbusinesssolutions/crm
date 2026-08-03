const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
async function run() {
    const { data, error } = await supabase.from('bot_flows').select('*');
    for (let flow of data) {
        let triggers = flow.nodes.filter(n => n.type === 'pipelineTrigger');
        if (triggers.length > 0) {
            console.log('Flow Name:', flow.name);
            console.log('Triggers:', JSON.stringify(triggers, null, 2));
        }
    }
}
run();
