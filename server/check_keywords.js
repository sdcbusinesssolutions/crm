const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const checkKeywords = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const targetFlowId = 'b6f40bf1-4100-4099-b413-7d13148d297c';

        const { data: flow, error } = await rpcClient
            .from('flows')
            .select('name, trigger_keywords')
            .eq('id', targetFlowId)
            .single();

        if (flow) {
            console.log(`Flow: ${flow.name}`);
            console.log(`Keywords:`, flow.trigger_keywords);
        }
    } catch (e) { console.error(e); }
};

checkKeywords();
