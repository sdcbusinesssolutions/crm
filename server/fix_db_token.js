const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: __dirname + '/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    const token = 'EAAialqCpZCtoBR4apZBo0hiPscszflZAyLBxjsHXLBtQcFzXZC3pNxfEC47oCRvvbbNBOn3CY53deNYLd1y62dEKtcQSI2TF74QGx5QfvqffmHXa9TwxPvoePvCLvbq2d0bcMDF6n6C4ius02ZBaJczZCnuJVjKsF9WimeloVoX9DSREqubOlruet6KTNcJzpYewZDZD';
    
    // Update all users' tokens for this testing session
    const { data: updated, error: updError } = await supabase
        .from('whatsapp_config')
        .update({ meta_access_token: token })
        .not('id', 'is', null);
        
    console.log('Update Error:', updError);
    console.log('Successfully updated the database tokens for testing.');
}

checkConfig();
