const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const checkFlows = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const userId = '5ae5999e-1eb2-4425-adf4-858156709d2d';

        const { data: flows, error } = await rpcClient
            .from('flows')
            .select('id, name, status, trigger_keywords, nodes')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching flows:', error);
            return;
        }

        console.log(`Found ${flows.length} flows.`);
        flows.forEach(f => {
            console.log(`[Flow] ${f.name} (${f.status})`);
            console.log(`Keywords: ${JSON.stringify(f.trigger_keywords)}`);
        });

    } catch (e) {
        console.error(e);
    }
};

checkFlows();
