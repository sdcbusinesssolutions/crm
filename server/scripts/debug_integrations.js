require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');

async function debugIntegrations() {
    console.log('--- DEBUGGING INTEGRATIONS ---');

    // 1. Get Automations
    const { data: automations, error: autoError } = await supabaseAdmin
        .from('sheet_automations')
        .select('id, name, connection_id');

    if (autoError) { console.error('Automations Error:', autoError); return; }

    console.log(`Found ${automations.length} automations.`);
    const connIds = [...new Set(automations.map(a => a.connection_id))];
    console.log('Unique Connection IDs:', connIds);

    // 2. Get Integrations
    const { data: integrations, error: intError } = await supabaseAdmin
        .from('user_integrations')
        .select('*')
        .in('id', connIds);

    if (intError) { console.error('Integrations Error:', intError); return; }

    console.log(`Found ${integrations.length} integrations.`);

    integrations.forEach(int => {
        console.log(`\n--- Integration: ${int.id} ---`);
        const c = int.credentials || {};
        console.log(`Type: ${c.type || 'N/A'}`);
        console.log(`Has Private Key: ${!!c.private_key}`);
        console.log(`Client Email: ${c.client_email}`);
        console.log(`Token URI: '${c.token_uri}'`);
        console.log(`Auth URI: '${c.auth_uri}'`);
        console.log(`Refresh Token: ${!!c.refresh_token}`);

        // Check Validity
        if (c.token_uri === undefined) console.warn('WARNING: token_uri is undefined');
        if (c.token_uri === '') console.warn('WARNING: token_uri is empty');
        if (typeof c.token_uri === 'string' && !c.token_uri.startsWith('http')) console.warn('WARNING: token_uri does not start with http');
    });
}

debugIntegrations();
