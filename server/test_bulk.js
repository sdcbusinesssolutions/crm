require('dotenv').config();
const { supabaseAdmin } = require('./lib/supabaseClient');
async function test() {
    const rates = ['MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE'].map(cat => ({
        scope: 'GLOBAL',
        category: cat,
        country_code: 'IN',
        meta_cost: 0.1,
        platform_rate: 0.2,
        is_active: true
    }));
    
    const upserts = rates.map(r => ({
        scope: r.scope || 'GLOBAL',
        category: r.category.toUpperCase(),
        country_code: r.country_code.toUpperCase(),
        meta_cost: Number(r.meta_cost),
        platform_rate: Number(r.platform_rate),
        is_active: r.is_active !== undefined ? r.is_active : true,
        user_id: r.user_id || null
    }));

    const { data, error } = await supabaseAdmin
        .from('wa_message_rates')
        .upsert(upserts, { onConflict: 'scope, category, country_code, user_id' })
        .select();
    console.log("Error:", error);
}
test();
