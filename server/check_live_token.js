const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkToken() {
    const userId = '1dd0acd9-090a-4c64-896e-4db51c775902';
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('meta_access_token')
        .eq('user_id', userId)
        .single();
        
    console.log('Error:', error);
    console.log('Live DB Token:', data?.meta_access_token);
}

checkToken();
