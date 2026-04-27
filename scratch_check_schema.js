const { supabaseAdmin } = require('./server/lib/supabaseClient');
require('dotenv').config({ path: './server/.env' });

async function checkSchema() {
    try {
        const { data, error } = await supabaseAdmin
            .from('conversations')
            .select('*')
            .limit(1);
        
        if (error) throw error;
        console.log('Conversations Column Names:', Object.keys(data[0] || {}));
    } catch (e) {
        console.error(e);
    }
}

checkSchema();
