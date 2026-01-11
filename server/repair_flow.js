const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const repairFlow = async () => {
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

        console.log(`Reparing Flow: ${flow.name}`);
        let nodes = flow.nodes || [];
        let edges = flow.edges || [];

        // 2. Check for OnMessage Node
        const hasOnMessage = nodes.some(n => n.type === 'onMessage');
        if (hasOnMessage) {
            console.log('Flow already has OnMessage node. Updating keywords only.');
            // Only ensure keyword '*' is present
            nodes = nodes.map(n => {
                if (n.type === 'onMessage') {
                    const k = n.data.keywords || [];
                    if (!k.includes('*')) k.push('*');
                    n.data.keywords = k;
                }
                return n;
            });
        } else {
            console.log('Flow missing OnMessage node. Creating one...');

            // Find New Lead node to connect to
            const newLeadNode = nodes.find(n => n.type === 'newLead');
            const targetId = newLeadNode ? newLeadNode.id : nodes[0]?.id;

            if (!targetId) {
                console.error('Flow has no nodes! Cannot connect start node.');
                return;
            }

            const startNodeId = `onMessage-wildcard-${Date.now()}`;

            // Create Start Node
            const startNode = {
                id: startNodeId,
                type: 'onMessage',
                position: { x: 0, y: 0 }, // Top left
                data: {
                    label: 'Start (Wildcard)',
                    keywords: ['*'],
                    messageType: 'Text'
                }
            };

            // Create Edge
            const newEdge = {
                id: `edge-${startNodeId}-${targetId}`,
                source: startNodeId,
                target: targetId,
                sourceHandle: 'default', // Standard handle
                type: 'smoothstep'
            };

            nodes.push(startNode);
            edges.push(newEdge);
            console.log(`Added Start Node -> ${targetId}`);
        }

        // 3. Update DB
        // The trigger will automatically update trigger_keywords column based on this JSON
        const { error: updateError } = await rpcClient
            .from('flows')
            .update({
                nodes: nodes,
                edges: edges,
                status: 'published'
            })
            .eq('id', targetFlowId);

        if (updateError) {
            console.error('Update failed:', updateError);
        } else {
            console.log('✅ Flow repaired successfully! triggers: [*]');
        }

    } catch (e) {
        console.error(e);
    }
};

repairFlow();
