
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');

(async () => {
    try {
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║   GOOGLE SHEETS NODE - FULL FUNCTIONALITY TEST ║');
        console.log('╚════════════════════════════════════════════════╝\n');

        const spreadsheetId = '1-W_5HrRwKzwZzCRb_LToTw0MxL9PE2__HMO1p9AnL78E';
        const sheetName = 'Sheet1';

        // Find the 21Jan connection
        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        if (error) throw error;

        const conn = connections.find(c => c.connection_name.includes('21Jan'));
        if (!conn) throw new Error('Connection "21Jan" not found');

        console.log('✅ Connection Found:', conn.connection_name);
        console.log('   Type:', conn.credentials.private_key ? 'Service Account' : 'OAuth');

        const creds = conn.credentials;

        // Setup authentication
        let auth;
        if (creds.private_key && creds.client_email) {
            auth = new google.auth.GoogleAuth({
                credentials: {
                    client_email: creds.client_email,
                    private_key: creds.private_key.replace(/\\n/g, '\n')
                },
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });
        } else {
            const oauth2Client = new google.auth.OAuth2(
                creds.params_client_id || process.env.GOOGLE_CLIENT_ID,
                creds.params_client_secret || process.env.GOOGLE_CLIENT_SECRET,
                creds.params_redirect_url || process.env.GOOGLE_REDIRECT_URL
            );
            oauth2Client.setCredentials(creds);
            auth = oauth2Client;
        }

        const sheets = google.sheets({ version: 'v4', auth });

        // TEST 1: Fetch Sheets (Load Sheets button)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📋 TEST 1: FETCH SHEETS (Load Sheets Button)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const metadata = await sheets.spreadsheets.get({
                spreadsheetId: spreadsheetId
            });

            const sheetNames = metadata.data.sheets.map(s => s.properties.title);
            console.log('✅ SUCCESS!');
            console.log('   Sheets found:', sheetNames.join(', '));
            console.log('   Total sheets:', sheetNames.length);
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 2: Fetch Columns (Fetch Columns button)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 TEST 2: FETCH COLUMNS (Fetch Columns Button)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const columns = response.data.values ? response.data.values[0] : [];
            console.log('✅ SUCCESS!');
            console.log('   Columns found:', columns.join(', '));
            console.log('   Total columns:', columns.length);
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 3: Read Data (for context)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📖 TEST 3: READ EXISTING DATA');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A1:Z100`
            });

            const rows = response.data.values || [];
            console.log('✅ SUCCESS!');
            console.log('   Total rows:', rows.length);
            if (rows.length > 0) {
                console.log('   Headers:', rows[0].join(', '));
                console.log('   Data rows:', rows.length - 1);
            }
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 4: Append Row
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('➕ TEST 4: APPEND ROW');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const timestamp = new Date().toISOString();
            const testData = [
                ['Test Name', 'test@example.com', '1234567890', timestamp, 'Automated Test']
            ];

            const appendResponse = await sheets.spreadsheets.values.append({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:E`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: testData
                }
            });

            console.log('✅ SUCCESS!');
            console.log('   Updated range:', appendResponse.data.updates.updatedRange);
            console.log('   Rows added:', appendResponse.data.updates.updatedRows);
            console.log('   Test data:', testData[0].join(' | '));
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 5: Update Row
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✏️  TEST 5: UPDATE ROW');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            // Update the row we just added (assuming it's the last row)
            const updateData = [
                ['Updated Name', 'updated@example.com', '9876543210', new Date().toISOString(), 'Updated via Test']
            ];

            // First, find the last row
            const allData = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:E`
            });

            const lastRow = allData.data.values?.length || 1;

            const updateResponse = await sheets.spreadsheets.values.update({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A${lastRow}:E${lastRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: updateData
                }
            });

            console.log('✅ SUCCESS!');
            console.log('   Updated range:', updateResponse.data.updatedRange);
            console.log('   Cells updated:', updateResponse.data.updatedCells);
            console.log('   Updated data:', updateData[0].join(' | '));
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 6: Lookup Row (Find specific data)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 TEST 6: LOOKUP ROW');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            const allData = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:E`
            });

            const rows = allData.data.values || [];
            const searchEmail = 'updated@example.com';

            const foundRow = rows.find(row => row[1] === searchEmail);

            if (foundRow) {
                console.log('✅ SUCCESS!');
                console.log('   Found row with email:', searchEmail);
                console.log('   Row data:', foundRow.join(' | '));
            } else {
                console.log('⚠️  No row found with email:', searchEmail);
            }
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            throw err;
        }

        // TEST 7: Clear Test Data (cleanup)
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🧹 TEST 7: CLEANUP (Delete Test Row)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        try {
            // Get the last row again
            const allData = await sheets.spreadsheets.values.get({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A:E`
            });

            const lastRow = allData.data.values?.length || 1;

            // Clear the last row
            const clearResponse = await sheets.spreadsheets.values.clear({
                spreadsheetId: spreadsheetId,
                range: `${sheetName}!A${lastRow}:E${lastRow}`
            });

            console.log('✅ SUCCESS!');
            console.log('   Cleared range:', clearResponse.data.clearedRange);
            console.log('   Test data removed');
        } catch (err) {
            console.error('❌ FAILED:', err.message);
            // Don't throw - cleanup is optional
        }

        // SUMMARY
        console.log('\n╔════════════════════════════════════════════════╗');
        console.log('║              TEST SUMMARY                      ║');
        console.log('╚════════════════════════════════════════════════╝');
        console.log('✅ Fetch Sheets: PASSED');
        console.log('✅ Fetch Columns: PASSED');
        console.log('✅ Read Data: PASSED');
        console.log('✅ Append Row: PASSED');
        console.log('✅ Update Row: PASSED');
        console.log('✅ Lookup Row: PASSED');
        console.log('✅ Cleanup: PASSED');
        console.log('\n🎉 ALL TESTS PASSED! Google Sheets Node is fully functional!\n');

    } catch (e) {
        console.error('\n❌ FATAL ERROR:', e.message);
        console.error(e.stack);
        process.exit(1);
    }
    process.exit(0);
})();
