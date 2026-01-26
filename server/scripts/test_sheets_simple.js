
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { supabaseAdmin } = require('../lib/supabaseClient');
const { google } = require('googleapis');

(async () => {
    const results = {
        fetchSheets: false,
        fetchColumns: false,
        readData: false,
        appendRow: false,
        updateRow: false
    };

    try {
        console.log('GOOGLE SHEETS NODE - FUNCTIONALITY TEST');
        console.log('========================================\n');

        const spreadsheetId = '1-W_5HrRwKzwZzCRb_LToTw0MxL9PE2__HMO1p9AnL78E';
        const sheetName = 'Sheet1';

        const { data: connections } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        const conn = connections.find(c => c.connection_name.includes('21Jan'));
        if (!conn) throw new Error('21Jan connection not found');

        console.log('Connection:', conn.connection_name);
        console.log('Type:', conn.credentials.private_key ? 'Service Account' : 'OAuth\n');

        const creds = conn.credentials;
        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: creds.client_email,
                private_key: creds.private_key.replace(/\\n/g, '\n')
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // TEST 1: Fetch Sheets
        console.log('[1/5] Testing: Fetch Sheets...');
        try {
            const metadata = await sheets.spreadsheets.get({ spreadsheetId });
            const sheetNames = metadata.data.sheets.map(s => s.properties.title);
            console.log('  SUCCESS - Sheets:', sheetNames.join(', '));
            results.fetchSheets = true;
        } catch (err) {
            console.log('  FAILED:', err.message);
        }

        // TEST 2: Fetch Columns
        console.log('\n[2/5] Testing: Fetch Columns...');
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!1:1`
            });
            const columns = response.data.values ? response.data.values[0] : [];
            console.log('  SUCCESS - Columns:', columns.length > 0 ? columns.join(', ') : '(empty sheet)');
            results.fetchColumns = true;
        } catch (err) {
            console.log('  FAILED:', err.message);
        }

        // TEST 3: Read Data
        console.log('\n[3/5] Testing: Read Data...');
        try {
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A1:Z10`
            });
            const rows = response.data.values || [];
            console.log('  SUCCESS - Rows:', rows.length);
            results.readData = true;
        } catch (err) {
            console.log('  FAILED:', err.message);
        }

        // TEST 4: Append Row
        console.log('\n[4/5] Testing: Append Row...');
        try {
            const testData = [['TestName', 'test@test.com', new Date().toISOString()]];
            const appendResponse = await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A:C`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: testData }
            });
            console.log('  SUCCESS - Added:', appendResponse.data.updates.updatedRows, 'row(s)');
            results.appendRow = true;
        } catch (err) {
            console.log('  FAILED:', err.message);
        }

        // TEST 5: Update Row
        console.log('\n[5/5] Testing: Update Row...');
        try {
            const allData = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!A:C`
            });
            const lastRow = allData.data.values?.length || 1;

            const updateData = [['UpdatedName', 'updated@test.com', new Date().toISOString()]];
            const updateResponse = await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${lastRow}:C${lastRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: updateData }
            });
            console.log('  SUCCESS - Updated:', updateResponse.data.updatedCells, 'cell(s)');
            results.updateRow = true;
        } catch (err) {
            console.log('  FAILED:', err.message);
        }

        // Summary
        console.log('\n========================================');
        console.log('SUMMARY:');
        console.log('========================================');
        console.log('Fetch Sheets:', results.fetchSheets ? 'PASS' : 'FAIL');
        console.log('Fetch Columns:', results.fetchColumns ? 'PASS' : 'FAIL');
        console.log('Read Data:', results.readData ? 'PASS' : 'FAIL');
        console.log('Append Row:', results.appendRow ? 'PASS' : 'FAIL');
        console.log('Update Row:', results.updateRow ? 'PASS' : 'FAIL');

        const allPassed = Object.values(results).every(r => r === true);
        console.log('\nResult:', allPassed ? 'ALL TESTS PASSED!' : 'SOME TESTS FAILED');
        console.log('========================================\n');

        process.exit(allPassed ? 0 : 1);

    } catch (e) {
        console.error('\nFATAL ERROR:', e.message);
        process.exit(1);
    }
})();
