/* eslint-disable no-prototype-builtins */
const axios = require('axios');
const sheetAutomationService = require('../../SheetAutomationService');

// Helper to convert column index to A1 Notation letter (e.g., 0 -> A, 25 -> Z, 26 -> AA)
function colIndexToLetter(index) {
    let temp, letter = '';
    while (index >= 0) {
        temp = index % 26;
        letter = String.fromCharCode(temp + 65) + letter;
        index = (index - temp - 26) / 26;
    }
    return letter;
}

const execute = async (session, node, context) => {
    try {
        const { data } = node;
        // Support both field names for compatibility
        const connectionId = data.credentialId || data.connectionId;
        const { rowData } = data;

        // Handle Action/Operation mapping consistently
        let operation = (data.operation || data.action || 'append').toLowerCase();
        
        // Legacy fix: Old nodes defaulted to action: 'READ' but showed 'Append Row' in UI. 
        if ((operation === 'read' || operation === 'update') && !data.lookupColumn) {
            console.log(`[FlowEngine] Node ${node.id} is resolving to ${operation} but missing lookupColumn. Overriding to 'append' (legacy fix).`);
            operation = 'append';
        }

        if (!connectionId) throw new Error('Missing Google Connection ID');
        if (!data.spreadsheetId || !data.sheetName) throw new Error('Missing Spreadsheet ID or Sheet Name');

        const spreadsheetId = String(data.spreadsheetId).trim();
        const sheetName = String(data.sheetName).trim();

        // Get Authenticated Client (Handles Refresh etc via Service)
        const authClient = await sheetAutomationService.getAuthClient(session.user_id, connectionId);
        const accessToken = authClient.credentials?.access_token;

        if (!accessToken) throw new Error('Failed to retrieve Access Token from Connection');

        console.log(`[FlowEngine] Executing Google Sheet Node: ${node.id} (${operation})`);

        // Helper for Axios (Proxy Bypass) - Omit data property if body is null to prevent GFE 400 Bad Request
        const request = async (method, url, body = null) => {
            const config = {
                method,
                url,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                proxy: false // CRITICAL: Bypass Invalid Host issues
            };
            if (body) config.data = body;
            return axios(config);
        };

        let result = {};
        const encodedSheet = encodeURIComponent(sheetName);

        // Fetch headers first (Required for all operations to map data correctly)
        // Optimization: Fetching only row 1 instead of the whole sheet
        const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!1:1`;
        const headerRes = await request('GET', headerUrl);
        const headers = headerRes.data.values ? headerRes.data.values[0] : [];
        
        if (!headers || headers.length === 0) throw new Error('Sheet is empty or has no headers.');

        if (operation === 'append') {
            // 2. Map Values
            const rowValues = headers.map(header => {
                const val = rowData[header];
                return val !== undefined ? val : '';
            });

            // 3. Append Request
            const appendUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}:append?valueInputOption=USER_ENTERED`;
            await request('POST', appendUrl, {
                values: [rowValues]
            });

            console.log('[Google Sheets] Append Success');
            result = { success: true, appended: true };

        } else if (operation === 'update' || operation === 'read' || operation === 'clear') {
            const { lookupColumn, lookupValue } = data;
            if (!lookupColumn || !lookupValue) throw new Error('Missing Lookup Column/Value');

            // Find Index of Lookup Column
            const colIdx = headers.findIndex(h => h.trim().toLowerCase() === lookupColumn.trim().toLowerCase());
            if (colIdx === -1) throw new Error(`Column '${lookupColumn}' not found`);

            // OPTIMIZATION: Fetch ONLY the specific lookup column, NOT the entire sheet.
            // This reduces memory overhead by 99% for large sheets.
            const colLetter = colIndexToLetter(colIdx);
            const lookupColUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!${colLetter}:${colLetter}`;
            
            const colRes = await request('GET', lookupColUrl);
            const colData = colRes.data.values || [];

            let rowIndex = -1;
            // Iterate column values (skip header at index 0)
            for (let i = 1; i < colData.length; i++) {
                if (colData[i] && String(colData[i][0]) === String(lookupValue)) {
                    rowIndex = i + 1; // 1-based index
                    break;
                }
            }

            if (rowIndex === -1) {
                console.warn(`[Google Sheets] '${lookupValue}' not found in column ${colLetter}. Skipping ${operation}.`);
                return { nextNodeId: node.data.nextNodeId, success: false, reason: 'not_found', found: false };
            }

            if (operation === 'update') {
                // Fetch the EXACT row we are updating to merge it
                const exactRowUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A${rowIndex}:Z${rowIndex}`;
                const rowRes = await request('GET', exactRowUrl);
                const oldRow = (rowRes.data.values && rowRes.data.values[0]) ? rowRes.data.values[0] : [];

                const newValues = headers.map((h, i) => {
                    const incomingVal = rowData[h];
                    const hasValueToUpdate = rowData.hasOwnProperty(h) && incomingVal !== '' && incomingVal !== null && incomingVal !== undefined;
                    return hasValueToUpdate ? incomingVal : (oldRow[i] || '');
                });

                // Update Request for the exact row
                const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A${rowIndex}?valueInputOption=USER_ENTERED`;
                await request('PUT', updateUrl, {
                    values: [newValues]
                });

                // Return full updated row
                const rowObject = {};
                headers.forEach((h, i) => rowObject[h] = newValues[i]);

                console.log('[Google Sheets] Update Success');
                result = { success: true, updated: true, ...rowObject };

            } else if (operation === 'read') {
                // Fetch the EXACT row
                const exactRowUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A${rowIndex}:Z${rowIndex}`;
                const rowRes = await request('GET', exactRowUrl);
                const foundRow = (rowRes.data.values && rowRes.data.values[0]) ? rowRes.data.values[0] : [];

                const rowObject = {};
                headers.forEach((h, i) => rowObject[h] = foundRow[i] || '');

                console.log('[Google Sheets] Read Success');
                result = { success: true, found: true, ...rowObject };

            } else if (operation === 'clear') {
                // To clear a row, we use the sheets.spreadsheets.values.clear endpoint
                const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!A${rowIndex}:Z${rowIndex}:clear`;
                await request('POST', clearUrl);

                console.log('[Google Sheets] Clear Success');
                result = { success: true, cleared: true };
            }
        }

        return { nextNodeId: node.data.nextNodeId, ...result };

    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        console.error('[FlowEngine] Google Sheet Error:', msg);
        if (error.response?.data) console.error('Details:', JSON.stringify(error.response.data));
        return { error: msg };
    }
};

module.exports = {
    execute
};
