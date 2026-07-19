const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function check() {
    const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_phone', '918408907516');
        
    const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('created_at, conversation_id, text, type, direction')
        .ilike('text', '%New user onboarded%');
        
    console.log("Found:", msgs);
}
check();
