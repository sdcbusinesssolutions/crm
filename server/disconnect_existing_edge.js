const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const disconnectExistingPath = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const targetFlowId = 'b6f40bf1-4100-4099-b413-7d13148d297c';

        // 1. Fetch Flow
        const { data: flow, error } = await rpcClient
            .from('flows')
            .select('*')
            .eq('id', targetFlowId)
            .single();

        if (error) {
            console.error('Error fetching flow:', error);
            return;
        }

        console.log(`Checking Flow: ${flow.name}`);
        let edges = flow.edges || [];
        const initialCount = edges.length;

        // 2. Filter out edges from 'newLead' with sourceHandle 'existing'
        // We find the newLead node first to be sure
        const newLeadNode = flow.nodes.find(n => n.type === 'newLead');

        if (!newLeadNode) {
            console.log('No newLead node found.');
            return;
        }

        console.log(`New Lead Node ID: ${newLeadNode.id}`);

        // Remove edges where source is newLeadNode and sourceHandle is 'existing' (or 'false' acting as existing)
        const newEdges = edges.filter(e => {
            if (e.source === newLeadNode.id && (e.sourceHandle === 'existing' || e.sourceHandle === 'false')) {
                console.log(`Removing edge: ${e.id} (Source: ${e.source}, Handle: ${e.sourceHandle})`);
                return false; // Remove
            }
            return true; // Keep
        });

        if (newEdges.length === initialCount) {
            console.log('No "Existing Contact" edges found to remove.');
        } else {
            // 3. Update DB
            const { error: updateError } = await rpcClient
                .from('flows')
                .update({ edges: newEdges })
                .eq('id', targetFlowId);

            if (updateError) console.error('Update failed:', updateError);
            else console.log('✅ Flow updated! "Existing Contact" path disconnected.');
        }

    } catch (e) {
        console.error(e);
    }
};

disconnectExistingPath();
