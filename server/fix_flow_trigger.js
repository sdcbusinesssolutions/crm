const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const fixFlow = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const targetFlowId = 'b6f40bf1-4100-4099-b413-7d13148d297c'; // Extracted from user logs (GET /flows/...)

        // 1. Fetch current flow
        const { data: flow, error } = await rpcClient
            .from('flows')
            .select('*')
            .eq('id', targetFlowId)
            .single();

        if (error) {
            console.error('Error fetching flow:', error);
            return;
        }

        console.log(`Checking Flow: ${flow.name} (${flow.id})`);
        console.log(`Current Keywords:`, flow.trigger_keywords);

        let newKeywords = flow.trigger_keywords || [];
        if (!newKeywords.includes('*')) {
            newKeywords.push('*');
            console.log(`Adding '*' to keywords...`);
        }

        // 2. Logic Check: Does the flow have a 'newLead' node?
        // But what acts as the 'Trigger'?
        // Usually 'onMessage' is the trigger.
        // User screenshot shows 'New Lead' node as first node (connected to Text Message).
        // But 'New Lead' is NOT a trigger node in the standard engine unless logic is adjusted.
        // However, standard engine flow starts at:
        // "Find node ... usually onMessage".
        // If the user DELETED 'onMessage' node and uses 'New Lead' as start...
        // We need to support that.

        // Let's inspect nodes.
        const startNode = flow.nodes.find(n => n.type === 'newLead');
        console.log('Has New Lead Node?', !!startNode);

        // 3. Update DB
        const { error: updateError } = await rpcClient
            .from('flows')
            .update({
                trigger_keywords: newKeywords,
                // We don't touch nodes, assuming user drew them correctly.
                // But we MUST ensure the flow is PUBLISHED.
                status: 'published'
            })
            .eq('id', targetFlowId);

        if (updateError) console.error('Update Error:', updateError);
        else console.log('✅ Flow updated successfully with wildcard trigger.');

    } catch (e) {
        console.error(e);
    }
};

fixFlow();
