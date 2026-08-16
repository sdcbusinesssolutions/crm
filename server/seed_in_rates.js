require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function seed() {
    const categories = [
        { category: 'MARKETING', meta_cost: 0.0000, platform_rate: 0.70 },
        { category: 'UTILITY', meta_cost: 0.0000, platform_rate: 0.22 },
        { category: 'AUTHENTICATION', meta_cost: 0.0000, platform_rate: 0.22 },
        { category: 'SERVICE', meta_cost: 0.0000, platform_rate: 0.20 }
    ];

    for (const cat of categories) {
        // Try inserting without explicitly setting user_id for GLOBAL
        const { error: err } = await supabaseAdmin
            .from('wa_message_rates')
            .upsert({
                scope: 'GLOBAL',
                category: cat.category,
                country_code: 'IN',
                meta_cost: cat.meta_cost,
                platform_rate: cat.platform_rate,
                is_active: true
            }, { onConflict: 'scope, category, country_code, user_id' });
        
        if (err) {
            console.error('Error inserting', cat.category, err);
        } else {
             console.log('Inserted', cat.category);
        }
    }
}
seed();
