const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { google } = require('googleapis');
const axios = require('axios');
const csv = require('csv-parse/sync');

// CLEANUP PROXY (Simulating server.js)
['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'NO_PROXY', 'no_proxy'].forEach(v => {
    if (process.env[v] !== undefined) delete process.env[v];
});

async function main() {
    console.log('--- STARTING DATABASE SERVICE ACCOUNT VERIFICATION ---');

    // 1. Parse domains.csv to get Credentials for clickube.com
    const csvPath = path.join(__dirname, '../domains.csv');
    console.log(`Reading domains config from: ${csvPath}`);

    const fileContent = fs.readFileSync(csvPath, 'utf8');
    const records = csv.parse(fileContent, {
        columns: true,
        skip_empty_lines: true
    });

    const targetDomain = 'clickube.com'; // User specified "clickube.com row"
    const domainConfig = records.find(r => r.Domain === targetDomain);

    if (!domainConfig) {
        throw new Error(`Domain ${targetDomain} not found in domains.csv`);
    }

    const supabaseUrl = domainConfig.SupabaseUrl;
    const serviceKey = domainConfig.SupabaseServiceKey;

    console.log(`✅ Found Config for ${targetDomain}`);
    console.log(`   URL: ${supabaseUrl}`);
    // console.log(`   Key: ${serviceKey.substring(0, 10)}...`);

    // 2. Connect to Supabase
    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    // 3. Fetch Service Account from user_integrations
    // We search for the specific email mentioned in previous errors
    const targetEmail = 'sheet-apiautoamtion-service-ac@maximal-arcadia-470418-g3.iam.gserviceaccount.com';
    console.log(`Searching DB for integration with email: ${targetEmail}`);

    // Since metadata is JSONB, we might need to filter manually if simple filter fails, 
    // but let's try to fetch all google integrations first to be safe.
    const { data: integrations, error } = await supabase
        .from('user_integrations')
        .select('*')
        .eq('provider', 'google');

    if (error) throw new Error(`Supabase Query Failed: ${error.message}`);

    const saIntegration = integrations.find(i =>
        (i.metadata && i.metadata.email === targetEmail) ||
        (i.credentials && i.credentials.client_email === targetEmail)
    );

    if (!saIntegration) {
        console.error('Available Integrations:', integrations.map(i => `${i.connection_name} (${i.metadata?.email})`));
        throw new Error(`Service Account integration not found in ${targetDomain} database.`);
    }

    console.log(`✅ Found Integration Record: ID=${saIntegration.id}, Name="${saIntegration.connection_name}"`);

    // 4. Test Google Auth using the credentials from DB
    const creds = saIntegration.credentials;
    let privateKey = creds.private_key;

    // Apply the Fix logic (simulating what the real server does)
    if (privateKey && typeof privateKey === 'string') {
        if (privateKey.includes('\\n')) privateKey = privateKey.replace(/\\n/g, '\n');
        privateKey = privateKey.replace(/^"|"$/g, '');
    }

    console.log('Authenticating with GoogleAuth (Live Check)...');

    try {
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: creds.client_email,
                private_key: privateKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const client = await auth.getClient();
        const tokenRes = await client.getAccessToken();
        const token = tokenRes.token || tokenRes;

        if (!token) throw new Error('Token generation returned null (Is key valid?)');
        console.log('✅ Authentication SUCCESSFUL! Token generated.');

        // 5. Real API Call Check (Fetch Sheets Metadata)
        const spreadsheetId = '1-W_5HrRwKzwZzCRb_LTo1w0MxU9E2__HMO1p9AnU78E'; // From user request
        console.log(`Attempting to fetch API data for Sheet: ${spreadsheetId}`);

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`;
        const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });

        const sheets = res.data.sheets;
        if (!sheets || sheets.length === 0) throw new Error('No sheets found');

        const firstSheetName = sheets[0].properties.title;
        console.log(`✅ Sheets Metadata Fetched. First Sheet: "${firstSheetName}"`);

        // 6. Fetch Columns (The Proof)
        console.log(`Fetching COLUMNS for "${firstSheetName}"...`);
        const colUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(firstSheetName)}!1:1`;
        const colRes = await axios.get(colUrl, { headers: { Authorization: `Bearer ${token}` } });

        const columns = colRes.data.values ? colRes.data.values[0] : [];
        console.log('✅ PROOF - COLUMNS FETCHED:');
        console.log(JSON.stringify(columns, null, 2));

    } catch (e) {
        throw new Error(`Auth/API Failed: ${e.message}`);
    }
}

main().catch(e => {
    console.error('❌ VERIFICATION FAILED:', e.message);
    if (e.response) console.error('API Response:', e.response.data);
});
