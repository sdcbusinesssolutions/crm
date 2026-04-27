const { supabaseAdmin } = require('../lib/supabaseClient');

async function checkSchema() {
    try {
        const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
        console.log("Attempting identical query to inbox.js...");
        const { data, count, error } = await supabaseAdmin
            .from('conversations')
            .select('id, contact_phone, contact_name, last_message, unread_count, updated_at, status, tags', { count: 'exact' })
            .eq('user_id', userId)
            .order('updated_at', { ascending: false })
            .range(0, 19);

        if (error) {
            console.error("Identical Query Error:", error);
        } else {
            console.log("Success! Fetched", data.length, "conversations.");
            console.log("Sample Data:", data[0]);
        }
    } catch (e) {
        console.error("Script failed:", e);
    }
}

checkSchema();
