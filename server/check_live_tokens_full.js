const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTokens() {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('user_id, meta_access_token');
        
    console.log('Live DB Tokens:');
    data?.forEach(row => {
        console.log(`User: ${row.user_id}, Token: ${row.meta_access_token}`);
    });
}

checkAllTokens();
