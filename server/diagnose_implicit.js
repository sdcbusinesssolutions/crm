const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const diagnoseImplicitFlow = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const userId = '5ae5999e-1eb2-4425-adf4-858156709d2d';

        // Fetch all published flows
        const { data: allFlows, error } = await rpcClient
            .from('flows')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'published');

        if (error) {
            console.error('Error fetching flows:', error);
            return;
        }

        console.log(`Found ${allFlows.length} published flows.`);

        allFlows.forEach(f => {
            console.log(`\nChecking Flow: ${f.name} (ID: ${f.id})`);

            // Check implicit logic: A flow starting with New Lead (no incoming edges)
            const newLeadNode = f.nodes.find(n => n.type === 'newLead');
            if (newLeadNode) {
                console.log(`  - Has New Lead Node: ${newLeadNode.id}`);
                const incomingEdges = f.edges.filter(e => e.target === newLeadNode.id);
                console.log(`  - Incoming Edges to New Lead: ${incomingEdges.length}`);
                if (incomingEdges.length === 0) {
                    console.log(`  ✅ This flow SHOULD match the implicit rule.`);
                } else {
                    console.log(`  ❌ New Lead is NOT the start node.`);
                }
            } else {
                console.log(`  - No "newLead" node found.`);
            }
        });

    } catch (e) { console.error(e); }
};

diagnoseImplicitFlow();
