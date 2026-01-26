/* eslint-disable no-prototype-builtins */
const axios = require('axios');
const sheetAutomationService = require('../../SheetAutomationService');

const execute = async (session, node, context) => {
    try {
        const { data } = node;
        // Support both field names for compatibility
        const connectionId = data.credentialId || data.connectionId;
        const { spreadsheetId, sheetName, rowData } = data;

        // Handle Action/Operation mapping consistently
        // Flow builder might send 'action', executor used to expect 'operation'
        // Default to 'append' if neither is set, but be careful with 'read'
        let operation = (data.operation || data.action || 'append').toLowerCase();

        if (!connectionId) throw new Error('Missing Google Connection ID');
        if (!spreadsheetId || !sheetName) throw new Error('Missing Spreadsheet ID or Sheet Name');

        // Get Authenticated Client (Handles Refresh etc via Service)
        // We assume getAuthClient returns an OAuth2Client with credentials
        const authClient = await sheetAutomationService.getAuthClient(session.user_id, connectionId);
        const accessToken = authClient.credentials?.access_token;

        if (!accessToken) throw new Error('Failed to retrieve Access Token from Connection');

        console.log(`[FlowEngine] Executing Google Sheet Node: ${node.id} (${operation})`);

        // Helper for Axios (Proxy Bypass)
        const request = async (method, url, body = null) => {
            return axios({
                method,
                url,
                data: body,
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                proxy: false // CRITICAL: Bypass Invalid Host issues
            });
        };

        let result = {};
        const encodedSheet = encodeURIComponent(sheetName);

        if (operation === 'append') {
            // 1. Fetch Request to map headers
            const headerUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}!1:1`;
            const headerRes = await request('GET', headerUrl);

            const headers = headerRes.data.values ? headerRes.data.values[0] : [];
            if (!headers || headers.length === 0) throw new Error('Sheet is empty or has no headers.');

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

        } else if (operation === 'update') {
            const { lookupColumn, lookupValue } = data;
            if (!lookupColumn || !lookupValue) throw new Error('Missing Lookup Column/Value');

            // 1. Fetch All Data
            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}`;
            const readRes = await request('GET', readUrl);
            const rows = readRes.data.values || [];

            if (rows.length === 0) throw new Error('Sheet is empty');
            const headers = rows[0];

            // 2. Find Index
            const colIdx = headers.findIndex(h => h.trim().toLowerCase() === lookupColumn.trim().toLowerCase());
            if (colIdx === -1) throw new Error(`Column '${lookupColumn}' not found`);

            let rowIndex = -1;
            // Iterate rows (skip header)
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][colIdx]) === String(lookupValue)) {
                    rowIndex = i + 1; // 1-based index
                    break;
                }
            }

            if (rowIndex === -1) {
                console.warn(`[Google Sheets] '${lookupValue}' not found. Skipping update.`);
                return { nextNodeId: node.data.nextNodeId, success: false, reason: 'not_found' };
            }

            // 3. Prepare Update
            const oldRow = rows[rowIndex - 1];
            const newValues = headers.map((h, i) => {
                return rowData.hasOwnProperty(h) ? rowData[h] : (oldRow[i] || '');
            });

            // 4. Update Request
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
            const { lookupColumn, lookupValue } = data;
            if (!lookupColumn || !lookupValue) throw new Error('Missing Lookup Column/Value');

            const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}`;
            const readRes = await request('GET', readUrl);
            const rows = readRes.data.values || [];

            if (rows.length === 0) throw new Error('Sheet is empty');
            const headers = rows[0];

            const colIdx = headers.findIndex(h => h.trim().toLowerCase() === lookupColumn.trim().toLowerCase());
            if (colIdx === -1) throw new Error(`Column '${lookupColumn}' not found`);

            let foundRow = null;
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][colIdx]) === String(lookupValue)) {
                    foundRow = rows[i];
                    break;
                }
            }

            if (!foundRow) {
                console.warn(`[Google Sheets] '${lookupValue}' not found.`);
                return { nextNodeId: node.data.nextNodeId, success: false, found: false };
            }

            const rowObject = {};
            headers.forEach((h, i) => rowObject[h] = foundRow[i] || '');

            console.log('[Google Sheets] Read Success');
            result = { success: true, found: true, ...rowObject };
        }

        return { nextNodeId: node.data.nextNodeId, ...result };

    } catch (error) {
        const msg = error.response?.data?.error?.message || error.message;
        console.error('[FlowEngine] Google Sheet Error:', msg);
        if (error.response?.data) console.error('Details:', JSON.stringify(error.response.data));
        return { error: msg };
    }
};

module.exports = { execute };
