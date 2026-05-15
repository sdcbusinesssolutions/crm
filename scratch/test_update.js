const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function testUpdate() {
    try {
        const { data: leads } = await supabaseAdmin.from('leads').select('id').limit(1);
        if (!leads || leads.length === 0) {
            console.log('No leads to test with.');
            return;
        }
        const leadId = leads[0].id;
        console.log('Testing update on lead:', leadId);

        const { data, error } = await supabaseAdmin
            .from('leads')
            .update({ assigned_staff_ids: ['test-id'] })
            .eq('id', leadId)
            .select();
        
        if (error) {
            console.log('Update Error Code:', error.code);
            console.log('Update Error Message:', error.message);
        } else {
            console.log('Update Success (Should not happen if column missing):', data);
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

testUpdate();
