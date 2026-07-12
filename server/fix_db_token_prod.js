require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Live Production Database Credentials from deployment logs
const supabaseUrl = 'https://dndmbarbnsdlbclghkbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRuZG1iYXJibnNkbGJjbGdoa2JzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQ4MjMxMywiZXhwIjoyMDk0MDU4MzEzfQ.kGyOt8oA0FfR_zXRJjK0lAzSTNKX3f6cK6b_wPmChxI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    const token = process.env.META_ACCESS_TOKEN;
    
    // Webhook log showed this is the active user: 1dd0acd9-090a-4c64-896e-4db51c775902
    const userId = '1dd0acd9-090a-4c64-896e-4db51c775902';

    const { data: updated, error: updError } = await supabase
        .from('whatsapp_config')
        .update({ meta_access_token: token })
        .eq('user_id', userId);
        
    console.log('Update Error:', updError);
    console.log('Successfully updated the PRODUCTION database token for user:', userId);
}

checkConfig();
