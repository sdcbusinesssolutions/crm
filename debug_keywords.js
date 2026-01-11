const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debugKeywords() {
    console.log('--- Debugging Flow Keywords ---');

    // 1. Fetch all flows
    const { data: flows, error } = await supabaseAdmin
        .from('flows')
        .select('id, name, status, trigger_keywords, nodes');

    if (error) {
        console.error('Error fetching flows:', error);
        return;
    }

    if (!flows || flows.length === 0) {
        console.log('No flows found.');
        return;
    }

    console.log(`Found ${flows.length} flows.`);

    for (const flow of flows) {
        console.log(`\nFlow: ${flow.name} (${flow.status})`);
        console.log(`ID: ${flow.id}`);
        console.log(`Trigger Keywords (Column):`, flow.trigger_keywords);

        // Manually check nodes to see what SHOULD be there
        const onMessageNodes = (flow.nodes || []).filter(n => n.type === 'onMessage');
        const manualKeywords = [];
        onMessageNodes.forEach(n => {
            if (n.data && n.data.keywords && Array.isArray(n.data.keywords)) {
                manualKeywords.push(...n.data.keywords);
            }
        });
        console.log(`Keywords in JSON (Nodes):`, manualKeywords);

        if (JSON.stringify(flow.trigger_keywords) !== JSON.stringify(manualKeywords.map(k => k.toLowerCase()))) {
            console.warn('MISMATCH: Column does not match JSON!');
        }
    }
}

debugKeywords();
