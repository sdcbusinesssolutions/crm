const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function simulateInboxQuery() {
    try {
        // The user ID from the conversation I found earlier
        const userId = '1dd0acd9-090a-4c64-896e-4db51c775902';
        
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .order('updated_at', { ascending: false });

        if (error) throw error;
        console.log('Results for user', userId, ':', data.length);
    } catch (err) {
        console.error('Catch error:', err);
    }
}

simulateInboxQuery();
