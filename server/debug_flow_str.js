const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const checkFlowStructure = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const userId = '5ae5999e-1eb2-4425-adf4-858156709d2d';

        const { data: flows, error } = await rpcClient
            .from('flows')
            .select('*')
            .eq('user_id', userId)
            .ilike('name', 'Untitled Flow');

        if (error || !flows) {
            console.error('Error:', error);
            return;
        }

        const flow = flows[0];
        console.log(`Flow ID: ${flow.id}`);
        console.log(`Keywords:`, flow.trigger_keywords);
        console.log(`Nodes Types:`, flow.nodes.map(n => n.type));
        console.log(`Nodes Data:`, JSON.stringify(flow.nodes, null, 2));

    } catch (e) {
        console.error(e);
    }
};

checkFlowStructure();
