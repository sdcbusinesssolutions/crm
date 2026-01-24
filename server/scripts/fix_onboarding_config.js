require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing SUPABASE env vars.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixConfig() {
    console.log("Updating Onboarding Config in DB...");

    const updates = {
        embedded_app_id: '1046904630557061',
        embedded_config_id: '976277771227161',
        // Ensure enabled is true
        embedded_enabled: true
    };

    // Update for 'system' user and 'clickube.com' domain (Master Config)
    const { data, error } = await supabase
        .from('onboarding_settings')
        .update(updates)
        .eq('user_id', 'system')
        .eq('domain', 'clickube.com')
        .select();

    if (error) {
        console.error("Error updating config:", error);
    } else {
        console.log("Success! Updated rows:", data);
        if (data.length === 0) {
            console.log("No matching row found. Attempting INSERT...");
            const { data: insertData, error: insertError } = await supabase
                .from('onboarding_settings')
                .insert([{
                    user_id: 'system',
                    domain: 'clickube.com',
                    ...updates
                }])
                .select();

            if (insertError) console.error("Insert failed:", insertError);
            else console.log("Inserted new config:", insertData);
        }
    }
}

fixConfig();
