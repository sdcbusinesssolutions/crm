
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { supabaseAdmin } = require('../lib/supabaseClient');
const axios = require('axios');

(async () => {
    try {
        console.log('--- DEBUG GOOGLE SHEETS CONNECTION ---');

        // Find Google connections
        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        if (error) { console.error('DB Error', error); return; }

        console.log(`Found ${connections.length} Google connections`);

        for (const conn of connections) {
            console.log(`\n--- Connection: ${conn.connection_name} (ID: ${conn.id}) ---`);
            console.log('User ID:', conn.user_id);
            console.log('Has Refresh Token:', !!conn.credentials.refresh_token);
            console.log('Expiry:', conn.credentials.expiry_date ? new Date(conn.credentials.expiry_date).toISOString() : 'None');

            // Test with the spreadsheet ID from the screenshot
            const testSpreadsheetId = '1-W_5HrRwKzwZzCRb_LToTw0MxL9PE2__HMO1p9AnL78E';

            console.log(`\nTesting with Spreadsheet ID: ${testSpreadsheetId}`);

            try {
                // Simulate the fetchWithRefresh logic
                const { google } = require('googleapis');

                let activeCreds = conn.credentials;
                const now = Date.now();
                const isExpiring = activeCreds.expiry_date && (activeCreds.expiry_date <= now + (5 * 60 * 1000));

                if (isExpiring) {
                    console.log('Token is expiring, attempting refresh...');

                    if (!activeCreds.refresh_token) {
                        console.error('❌ NO REFRESH TOKEN - User must reconnect!');
                        continue;
                    }

                    const oauth2Client = new google.auth.OAuth2(
                        activeCreds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                        activeCreds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                        activeCreds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
                    );

                    oauth2Client.setCredentials(activeCreds);

                    const { credentials } = await oauth2Client.refreshAccessToken();
                    console.log('✅ Token refreshed successfully');
                    activeCreds = { ...activeCreds, ...credentials };
                }

                // Now try to fetch sheets
                const url = `https://sheets.googleapis.com/v4/spreadsheets/${testSpreadsheetId}?includeGridData=false`;
                console.log(`Fetching: ${url}`);

                const response = await axios.get(url, {
                    headers: { Authorization: `Bearer ${activeCreds.access_token}` }
                });

                const sheetNames = response.data.sheets.map(s => s.properties.title);
                console.log('✅ SUCCESS! Sheets:', sheetNames);

            } catch (err) {
                console.error('❌ FAILED:', err.message);
                if (err.response) {
                    console.error('API Error:', err.response.status, err.response.data);
                }
            }
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
    process.exit(0);
})();
