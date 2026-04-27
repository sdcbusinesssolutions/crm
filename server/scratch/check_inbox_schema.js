const { supabaseAdmin } = require('../lib/supabaseClient');

async function checkSchema() {
    try {
        console.log("Checking conversations table columns...");
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .limit(1);

        if (error) {
            console.error("Error fetching conversations:", error);
        } else {
            console.log("Success! Columns found:", Object.keys(data[0] || {}));
        }

        console.log("\nChecking RLS policies (via indirect error check)...");
        // We can't see policies directly, but we can try a non-admin query if we had a token.
    } catch (e) {
        console.error("Script failed:", e);
    }
}

checkSchema();
