const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function debugFlows() {
    console.log('--- Debugging Flows Table ---');

    // 1. Fetch the most recently updated flow
    const { data: flows, error } = await supabaseAdmin
        .from('flows')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error('Error fetching flows:', error);
        return;
    }

    if (!flows || flows.length === 0) {
        console.log('No flows found in the database.');
        return;
    }

    const flow = flows[0];
    console.log(`Latest Flow: ${flow.name} (ID: ${flow.id})`);
    console.log(`User ID: ${flow.user_id}`);

    // 2. Check for Webhook Nodes
    const nodes = flow.nodes || [];
    console.log(`Total Nodes: ${nodes.length}`);

    const webhookNodes = nodes.filter(n => n.type === 'setWebhook' || n.data?.webhookId);

    if (webhookNodes.length === 0) {
        console.log('No SetWebhook nodes found in this flow.');
        // Print all node types to see what's there
        console.log('Node Types present:', nodes.map(n => n.type).join(', '));
    } else {
        console.log('Found Webhook Nodes:');
        webhookNodes.forEach(n => {
            console.log(`- Node ID: ${n.id}`);
            console.log(`  Type: ${n.type}`);
            console.log(`  WebhookID: ${n.data?.webhookId}`);
            console.log(`  Label: ${n.data?.label}`);
        });
    }

    // 3. Test the Search Query Logic
    console.log('\n--- Testing Search Logic ---');
    const targetWebhookId = '7llu9oyn'; // The one from the user's error

    const { data: searchResults, error: searchError } = await supabaseAdmin
        .from('flows')
        .select('id, name')
        // This is the query used in incoming_webhooks.js
        // We need to be careful with the syntax here. 
        // Supabase JS .contains() on a JSONB array column:
        // .contains('nodes', JSON.stringify([{ data: { webhookId: targetWebhookId } }]))
        .contains('nodes', JSON.stringify([{ data: { webhookId: targetWebhookId } }]));

    if (searchError) {
        console.error('Search Query Error:', searchError);
    } else {
        console.log(`Search Query Results for ${targetWebhookId}:`, searchResults.length);
        if (searchResults.length > 0) {
            console.log('Found in flows:', searchResults.map(f => f.name).join(', '));
        } else {
            console.log('NOT FOUND via search query.');
        }
    }
}

debugFlows();
