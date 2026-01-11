const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const checkFlowStatus = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const userId = '5ae5999e-1eb2-4425-adf4-858156709d2d';

        // Fetch ALL flows regardless of status
        const { data: flows, error } = await rpcClient
            .from('flows')
            .select('id, name, status')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching flows:', error);
            return;
        }

        console.log(`Total Flows Found: ${flows.length}`);
        flows.forEach(f => {
            console.log(`- Flow: "${f.name}" | Status: "${f.status}" (Type: ${typeof f.status})`);
        });

    } catch (e) {
        console.error(e);
    }
};

checkFlowStatus();
