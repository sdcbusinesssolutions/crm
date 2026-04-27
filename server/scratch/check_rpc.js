const { supabaseAdmin } = require('../lib/supabaseClient');

async function checkRpc() {
    try {
        console.log("Attempting to call 'get_dashboard_stats' RPC...");
        // Use a known user_id if possible, or just a dummy one
        // The logs showed a user ID: 38edee2f-04c5-4f4c-8ca1-baed6ed84711
        const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
        
        const { data, error } = await supabaseAdmin.rpc('get_dashboard_stats', { p_user_id: userId });

        if (error) {
            console.error("RPC Error:", error.message);
            if (error.message.includes('function get_dashboard_stats(...) does not exist')) {
                console.log("❌ RPC is MISSING.");
            }
        } else {
            console.log("✅ RPC exists and returned data:", data);
        }
    } catch (e) {
        console.error("Script failed:", e);
    }
}

checkRpc();
