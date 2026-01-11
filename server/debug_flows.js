const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const checkFlows = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const userId = '5ae5999e-1eb2-4425-adf4-858156709d2d';

        console.log(`Checking flows for User: ${userId}`);

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
            console.log(`\n[Flow] ID: ${f.id}`);
            console.log(`- Name: ${f.name}`);
            console.log(`- Status: ${f.status}`);
            console.log(`- Keywords (Column):`, f.trigger_keywords);

            // Checking inside nodes for 'onMessage'
            const onMessageNodes = f.nodes.filter(n => n.type === 'onMessage');
            onMessageNodes.forEach(n => {
                console.log(`  - Node ${n.id} (onMessage) Keywords:`, n.data.keywords);
            });
        });

    } catch (e) {
        console.error(e);
    }
};

checkFlows();
