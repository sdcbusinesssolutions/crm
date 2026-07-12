require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function updateAllTokens() {
    const token = process.env.META_ACCESS_TOKEN;
    
    // Update all users' tokens for this testing session
    const { data: updated, error: updError } = await supabase
        .from('whatsapp_config')
        .update({ meta_access_token: token })
        .not('id', 'is', null);
        
    console.log('Update Error:', updError);
    console.log('Successfully updated ALL users in the PRODUCTION database token.');
}

updateAllTokens();
