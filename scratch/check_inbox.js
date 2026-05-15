const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function checkConversations() {
    try {
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .limit(10);
        
        if (error) {
            console.error('Error fetching conversations:', error);
            return;
        }

        console.log('Conversations count:', data.length);
        if (data.length > 0) {
            console.log('Sample conversation keys:', Object.keys(data[0]));
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkConversations();
