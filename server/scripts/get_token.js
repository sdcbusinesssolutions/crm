const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data } = await supabase.from('whatsapp_config').select('meta_access_token').eq('whatsapp_business_account_id', '2123958538361848').single();
    console.log(data.meta_access_token);
}
run();
