const { google } = require('googleapis');
const sheetAutomationService = require('../../SheetAutomationService');

const execute = async (session, node, context) => {
    try {
        const { data } = node;
        // Support both field names for compatibility
        const connectionId = data.credentialId || data.connectionId;
        const { spreadsheetId, sheetName, operation, rowData } = data;

        if (!connectionId) {
            throw new Error('Missing Google Connection ID');
        }

        if (!spreadsheetId || !sheetName) {
            throw new Error('Missing Spreadsheet ID or Sheet Name');
        }

        // Get Authenticated Client (Handles Refresh & Service Accounts)
        const authClient = await sheetAutomationService.getAuthClient(session.user_id, connectionId);

        // Initialize Sheets API
        const sheets = google.sheets({ version: 'v4', auth: authClient });

        console.log(`[FlowEngine] Executing Google Sheet Node: ${node.id}`);
        console.log(`Operation: ${operation}, Spreadsheet: ${spreadsheetId}, Sheet: ${sheetName}`);

        let result = {};

        if (operation === 'append' || !operation) {
            // 1. Prepare values based on columns
            // We need to know the order of columns in the sheet to append correctly
            // First, fetch the header row
            console.log('[Google Sheets] Fetching headers to map values order...');
            const headerRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!1:1`
            });

            const headers = headerRes.data.values ? headerRes.data.values[0] : [];
            if (!headers || headers.length === 0) {
                throw new Error('Sheet is empty or has no headers. Please add headers to the first row.');
            }

            // 2. Map rowData keys to header positions
            const rowValues = headers.map(header => {
                // rowData keys might match header exactly
                const value = rowData[header] || '';
                return value; // The 'resolvedNode' passed to this function already has variables resolved by FlowEngine
            });

            console.log('[Google Sheets] Appending row:', rowValues);

            await sheets.spreadsheets.values.append({
                spreadsheetId,
                range: sheetName,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [rowValues]
                }
            });

            result = { success: true, appended: true, row: rowValues };
            console.log('[Google Sheets] Append Success');
        } else if (operation === 'update') {
            const { lookupColumn, lookupValue } = data;
            if (!lookupColumn || !lookupValue) {
                throw new Error('Missing Lookup Column or Lookup Value for update operation');
            }

            console.log(`[Google Sheets] Update Request: Searching for '${lookupValue}' in column '${lookupColumn}'`);

            // 1. Fetch entire sheet data (or large chunk) to find the row
            const dataRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: sheetName, // Fetch all data
            });

            const rows = dataRes.data.values || [];
            if (rows.length === 0) throw new Error('Sheet is empty');

            const headers = rows[0];
            const columnIndex = headers.findIndex(h => h.trim().toLowerCase() === lookupColumn.trim().toLowerCase());

            if (columnIndex === -1) throw new Error(`Lookup Column '${lookupColumn}' not found in headers`);

            // 2. Find row index (1-based because API is 1-based, but array is 0-based.
            // Header is row 1. First data row is row 2.
            // rowIndexInArray + 1 (for 1-based) is the row number.
            let rowIndexToUpdate = -1;

            // Start searching from index 1 (skip header)
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][columnIndex]) === String(lookupValue)) {
                    rowIndexToUpdate = i + 1; // Google Sheets row number
                    break;
                }
            }

            if (rowIndexToUpdate === -1) {
                console.warn(`[Google Sheets] Value '${lookupValue}' not found. Skipping update.`);
                return { nextNodeId: node.data.nextNodeId || null, success: false, reason: 'not_found' };
            }

            console.log(`[Google Sheets] Found match at Row ${rowIndexToUpdate}`);

            // 3. Prepare Update Data
            // We only want to update the columns specified in rowData, leaving others intact?
            // Or do we overwrite the whole row?
            // "Update Row" usually implies updating specific fields.
            // To do this efficiently without overwriting other cells, we might need to update cell by cell or construct a full row.
            // EASIEST ROBUST WAY: Update specific cells OR assume rowData contains changes.

            // Let's construct a NEW row based on the OLD row, merging changes.
            const oldRow = rows[rowIndexToUpdate - 1]; // Array access 0-based
            const newRowValues = headers.map((header, idx) => {
                if (rowData.hasOwnProperty(header)) {
                    return rowData[header]; // Update with new value
                }
                return oldRow[idx] || ''; // Keep old value or empty if missing
            });

            // 4. Update the Row
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A${rowIndexToUpdate}`, // Update entire row starting at A
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: [newRowValues]
                }
            });

            // Return the FULL updated row as variables
            const rowObject = {};
            headers.forEach((h, i) => {
                rowObject[h] = newRowValues[i];
            });

            console.log('[Google Sheets] Update Success');
            result = { success: true, updated: true, row: rowIndexToUpdate, ...rowObject };

        } else if (operation === 'read') {
            const { lookupColumn, lookupValue } = data;
            if (!lookupColumn || !lookupValue) {
                throw new Error('Missing Lookup Column or Lookup Value for read operation');
            }

            console.log(`[Google Sheets] Read Request: Searching for '${lookupValue}' in column '${lookupColumn}'`);

            const dataRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: sheetName,
            });

            const rows = dataRes.data.values || [];
            if (rows.length === 0) throw new Error('Sheet is empty');

            const headers = rows[0];
            const columnIndex = headers.findIndex(h => h.trim().toLowerCase() === lookupColumn.trim().toLowerCase());

            if (columnIndex === -1) throw new Error(`Lookup Column '${lookupColumn}' not found in headers`);

            let foundRow = null;
            for (let i = 1; i < rows.length; i++) {
                if (String(rows[i][columnIndex]) === String(lookupValue)) {
                    foundRow = rows[i];
                    break;
                }
            }

            if (!foundRow) {
                console.warn(`[Google Sheets] Value '${lookupValue}' not found.`);
                return { nextNodeId: node.data.nextNodeId || null, success: false, found: false };
            }

            // Map headers to values
            const rowObject = {};
            headers.forEach((h, i) => {
                rowObject[h] = foundRow[i] || '';
            });

            console.log('[Google Sheets] Read Success');
            result = { success: true, found: true, ...rowObject };
        }

        return {
            nextNodeId: node.data.nextNodeId || null,
            ...result
        };

    } catch (error) {
        console.error('[FlowEngine] Google Sheet Error:', error);
        return { error: error.message };
    }
};

module.exports = { execute };
