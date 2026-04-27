const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function checkSchema() {
    try {
        console.log('Checking Conversations table schema...');
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .limit(1);
        
        if (error) {
            console.error('Query Error:', error);
            return;
        }
        
        if (!data || data.length === 0) {
            console.log('No conversations found to inspect.');
            return;
        }
        
        console.log('Conversations Table Columns:', Object.keys(data[0]));
    } catch (e) {
        console.error('Exception:', e);
    }
}

checkSchema();
