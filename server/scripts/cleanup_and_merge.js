const { supabaseAdmin } = require('../lib/supabaseClient');

const BATCH_SIZE = 1000;

async function cleanAndMergeTable(tableName, phoneCol, mergeLogic) {
    console.log(`\nProcessing table '${tableName}' column '${phoneCol}'...`);

    // Fetch rows that might need cleaning (anything NOT matching pure digits)
    // Supabase filter for regex is tricky, so we fetch broadly or fetch all if not too huge.
    // Or fetch where column like '%+%' OR column like '% %' OR column like '%-%'
    // Here we will process ALL rows to be safe and ensure total consistency
    // Pagination to avoid memory issues.

    let offset = 0;
    let processed = 0;

    while (true) {
        const { data: rows, error } = await supabaseAdmin
            .from(tableName)
            .select('*') // Need ID and phone
            .range(offset, offset + BATCH_SIZE - 1);

        if (error) {
            console.error(`Error fetching ${tableName}:`, error);
            break;
        }
        if (!rows || rows.length === 0) break;

        for (const row of rows) {
            const originalVal = row[phoneCol];
            if (!originalVal) continue;

            const cleanVal = originalVal.replace(/\D/g, ''); // Extract digits only

            if (cleanVal !== originalVal) {
                // Needs cleanup
                // Try Update
                const { error: updateError } = await supabaseAdmin
                    .from(tableName)
                    .update({ [phoneCol]: cleanVal })
                    .eq('id', row.id);

                if (updateError) {
                    // Assumption: Update failed due to duplicate/unique constraint (e.g. cleanVal already exists)
                    // If so, we should MERGE this row into the existing one.
                    console.log(`Conflict updating ${tableName} ID ${row.id} to ${cleanVal}. Attempting merge...`);

                    // Find Target
                    const { data: targets } = await supabaseAdmin
                        .from(tableName)
                        .select('id')
                        .eq(phoneCol, cleanVal);

                    const target = targets && targets[0];

                    if (target) {
                        try {
                            if (mergeLogic) await mergeLogic(row, target);
                            // Delete source row
                            await supabaseAdmin.from(tableName).delete().eq('id', row.id);
                            console.log(`Merged & Deleted ${tableName} row ${row.id} -> ${target.id}`);
                        } catch (e) {
                            console.error(`Merge failed for ${tableName} ID ${row.id}:`, e);
                        }
                    } else {
                        // Weird: Update failed but target not found? Maybe RLS or other constraint?
                        // Just log
                        console.error(`Update failed but target not found for ${tableName} ${row.id}:`, updateError.message);
                    }
                } else {
                    // Update success
                    // console.log(`Cleaned ${tableName} ${row.id}: ${originalVal} -> ${cleanVal}`);
                }
            }
        }

        processed += rows.length;
        offset += BATCH_SIZE;
        console.log(`Scanned ${processed} rows...`);
        if (rows.length < BATCH_SIZE) break;
    }
}

async function updateContactNames() {
    console.log('\nCleaning Contact Names (Contacts & Conversations)...');

    const tables = [
        { name: 'contacts', col: 'name' },
        { name: 'conversations', col: 'contact_name' }
    ];

    for (const t of tables) {
        // Fetch rows where name starts with +
        const { data: rows } = await supabaseAdmin
            .from(t.name)
            .select(`id, ${t.col}`)
            .like(t.col, '+%');

        if (rows && rows.length > 0) {
            for (const row of rows) {
                const name = row[t.col];
                const cleanName = name.replace(/^\+/, ''); // Remove leading +

                // If it looks like a phone number (mostly digits), strip completely
                // But replace('+', '') matches user request "unser prefer is without plus"

                await supabaseAdmin
                    .from(t.name)
                    .update({ [t.col]: cleanName })
                    .eq('id', row.id);
            }
            console.log(`Cleaned ${rows.length} names in ${t.name}`);
        } else {
            console.log(`No names starting with + found in ${t.name}`);
        }
    }
}

async function run() {
    console.log('--- STRICT CLEANUP START ---');

    // 1. Clean Names
    await updateContactNames();

    // 2. Conversations
    // Merge Logic: Move messages, then delete
    const convoMerge = async (sourceRow, targetRow) => {
        // Move messages from source conversation to target conversation
        const { error } = await supabaseAdmin
            .from('messages')
            .update({ conversation_id: targetRow.id })
            .eq('conversation_id', sourceRow.id);
        if (error) throw error;
        console.log(`Moved messages from Convo ${sourceRow.id} to ${targetRow.id}`);
    };
    await cleanAndMergeTable('conversations', 'contact_phone', convoMerge);

    // 3. Contacts
    // Merge Logic: Relink campaign_queue
    const contactMerge = async (sourceRow, targetRow) => {
        const { error } = await supabaseAdmin
            .from('campaign_queue')
            .update({ contact_id: targetRow.id })
            .eq('contact_id', sourceRow.id);
        if (error) throw error;
        // Check for other tables if needed?
    };
    await cleanAndMergeTable('contacts', 'phone', contactMerge);

    // 4. Other tables (Just clean, no uniqueness expected usually, or just let error fail)
    await cleanAndMergeTable('messages', 'contact_phone', null); // Messages usually allow duplicates or not unique on phone
    await cleanAndMergeTable('whatsapp_flow_submissions', 'contact_phone', null);
    await cleanAndMergeTable('campaign_queue', 'phone_number', null);

    console.log('--- STRICT CLEANUP COMPLETE ---');
}

run();
