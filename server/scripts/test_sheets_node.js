
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');

(async () => {
    try {
        console.log('=== TESTING GOOGLE SHEETS NODE CONNECTION ===\n');

        const spreadsheetId = '1-W_5HrRwKzwZzCRb_LToTw0MxL9PE2__HMO1p9AnL78E';
        const sheetName = 'Sheet1';

        // Find the 21Jan connection
        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        if (error) {
            console.error('❌ DB Error:', error);
            process.exit(1);
        }

        const conn = connections.find(c => c.connection_name.includes('21Jan'));

        if (!conn) {
            console.error('❌ Connection "21Jan" not found');
            console.log('Available connections:', connections.map(c => c.connection_name));
            process.exit(1);
        }

        console.log('✅ Found Connection:', conn.connection_name);
        console.log('   ID:', conn.id);
        console.log('   User ID:', conn.user_id);
        console.log('   Type:', conn.credentials.private_key ? 'Service Account' : 'OAuth');

        const creds = conn.credentials;

        // Check if it's a service account or OAuth
        if (creds.private_key && creds.client_email) {
            console.log('\n📋 SERVICE ACCOUNT DETECTED');
            console.log('   Email:', creds.client_email);
            console.log('   Has Private Key:', !!creds.private_key);

            // Test service account authentication
            try {
                const auth = new google.auth.GoogleAuth({
                    credentials: {
                        client_email: creds.client_email,
                        private_key: creds.private_key.replace(/\\n/g, '\n')
                    },
                    scopes: ['https://www.googleapis.com/auth/spreadsheets']
                });

                const sheets = google.sheets({ version: 'v4', auth });

                console.log('\n🔍 Testing: Fetch Sheet Metadata...');
                const metadata = await sheets.spreadsheets.get({
                    spreadsheetId: spreadsheetId
                });

                const sheetNames = metadata.data.sheets.map(s => s.properties.title);
                console.log('✅ SUCCESS! Sheets found:', sheetNames);

                console.log('\n🔍 Testing: Fetch Sheet Data...');
                const data = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: `${sheetName}!A1:Z10`
                });

                console.log('✅ SUCCESS! Rows fetched:', data.data.values?.length || 0);
                if (data.data.values && data.data.values.length > 0) {
                    console.log('   First row:', data.data.values[0]);
                }

            } catch (err) {
                console.error('❌ Service Account Test Failed:', err.message);
                if (err.response) {
                    console.error('   Status:', err.response.status);
                    console.error('   Error:', err.response.data);
                }
            }

        } else {
            console.log('\n🔐 OAUTH CONNECTION DETECTED');
            console.log('   Has Refresh Token:', !!creds.refresh_token);
            console.log('   Expiry:', creds.expiry_date ? new Date(creds.expiry_date).toISOString() : 'None');

            const now = Date.now();
            const isExpired = creds.expiry_date && creds.expiry_date < now;
            const isExpiring = creds.expiry_date && creds.expiry_date < now + (5 * 60 * 1000);

            console.log('   Status:', isExpired ? '❌ EXPIRED' : isExpiring ? '⚠️ EXPIRING SOON' : '✅ VALID');

            if (!creds.refresh_token) {
                console.error('\n❌ CRITICAL: No refresh token! User must reconnect.');
                process.exit(1);
            }

            // Test OAuth authentication
            try {
                const oauth2Client = new google.auth.OAuth2(
                    creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                    creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                    creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
                );

                oauth2Client.setCredentials(creds);

                // Refresh if needed
                if (isExpiring) {
                    console.log('\n🔄 Token expiring, refreshing...');
                    const { credentials } = await oauth2Client.refreshAccessToken();
                    oauth2Client.setCredentials({ ...creds, ...credentials });
                    console.log('✅ Token refreshed successfully');
                }

                const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

                console.log('\n🔍 Testing: Fetch Sheet Metadata...');
                const metadata = await sheets.spreadsheets.get({
                    spreadsheetId: spreadsheetId
                });

                const sheetNames = metadata.data.sheets.map(s => s.properties.title);
                console.log('✅ SUCCESS! Sheets found:', sheetNames);

                console.log('\n🔍 Testing: Fetch Sheet Data...');
                const data = await sheets.spreadsheets.values.get({
                    spreadsheetId: spreadsheetId,
                    range: `${sheetName}!A1:Z10`
                });

                console.log('✅ SUCCESS! Rows fetched:', data.data.values?.length || 0);
                if (data.data.values && data.data.values.length > 0) {
                    console.log('   First row:', data.data.values[0]);
                }

            } catch (err) {
                console.error('❌ OAuth Test Failed:', err.message);
                if (err.response) {
                    console.error('   Status:', err.response.status);
                    console.error('   Error:', JSON.stringify(err.response.data, null, 2));
                }

                if (err.message.includes('invalid_grant')) {
                    console.error('\n💡 SOLUTION: The refresh token is invalid. User must:');
                    console.error('   1. Delete this connection');
                    console.error('   2. Reconnect Google account');
                }
            }
        }

    } catch (e) {
        console.error('❌ Fatal Error:', e.message);
        console.error(e.stack);
    }
    process.exit(0);
})();
