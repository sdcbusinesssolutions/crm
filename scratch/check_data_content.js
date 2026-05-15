const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function checkActualData() {
    try {
        const { data: leads, error } = await supabaseAdmin
            .from('leads')
            .select('id, name, custom_data')
            .not('custom_data', 'is', null)
            .limit(5);
        
        if (error) {
            console.error('Error:', error);
            return;
        }

        console.log('Leads with custom_data:', JSON.stringify(leads, null, 2));
    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkActualData();
