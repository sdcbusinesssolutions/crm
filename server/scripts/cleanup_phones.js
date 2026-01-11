const { supabaseAdmin } = require('../lib/supabaseClient');

const BATCH_SIZE = 1000;

async function updateTable(tableName, column, idField = 'id') {
    console.log(`Processing table '${tableName}' column '${column}'...`);
    let processedCount = 0;

    while (true) {
        // Fetch a batch of rows that need updating
        const { data: rows, error } = await supabaseAdmin
            .from(tableName)
            .select(`${idField}, ${column}`)
            .like(column, '+%') // Matches strings starting with '+'
            .range(0, BATCH_SIZE - 1);

        if (error) {
            console.error(`Error fetching rows from ${tableName}:`, error);
            break;
        }

        if (!rows || rows.length === 0) {
            break; // No more rows to process
        }

        // Process sequentially to ensure updates complete
        for (const row of rows) {
            const originalValue = row[column];
            const cleanValue = originalValue.replace('+', '');

            const { error: updateError } = await supabaseAdmin
                .from(tableName)
                .update({ [column]: cleanValue })
                .eq(idField, row[idField]);

            if (updateError) {
                console.error(`Failed to update ${tableName} ID ${row[idField]}:`, updateError);
            } else {
                // console.log(`Updated ${tableName} ID ${row[idField]}: ${originalValue} -> ${cleanValue}`);
            }
        }

        processedCount += rows.length;
        console.log(`Processed ${processedCount} rows in ${tableName}...`);

        // If we fetched fewer than batch size, we are done
        if (rows.length < BATCH_SIZE) break;
    }
    console.log(`Finished ${tableName}. Total processed: ${processedCount}`);
}

async function run() {
    console.log('Starting Phone Number Cleanup...');

    // 1. Clean Contacts (id, phone)
    await updateTable('contacts', 'phone', 'id');

    // 2. Clean Conversations (id, contact_phone)
    await updateTable('conversations', 'contact_phone', 'id');

    // 3. Clean Messages (id, contact_phone)
    await updateTable('messages', 'contact_phone', 'id');

    // 4. Clean Flow Submissions (id, contact_phone)
    await updateTable('whatsapp_flow_submissions', 'contact_phone', 'id');

    // 5. Clean Campaign Queue (id, phone_number)
    await updateTable('campaign_queue', 'phone_number', 'id');

    console.log('Cleanup Complete!');
}

run();
