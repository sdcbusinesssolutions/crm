const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function simulateLeadsJsUpdate() {
    try {
        const { data: leads } = await supabaseAdmin.from('leads').select('id, custom_data').limit(1);
        const lead = leads[0];
        console.log('Original lead:', lead);

        const updates = { assigned_staff_ids: ['staff-1', 'staff-2'] };
        
        // Simulating the leads.js logic
        if (updates.assigned_staff_ids) {
            updates.custom_data = { 
                ...(lead.custom_data || {}), 
                assigned_staff_ids: updates.assigned_staff_ids 
            };
        }

        console.log('Attempting update with:', updates);

        const { data, error } = await supabaseAdmin
            .from('leads')
            .update(updates)
            .eq('id', lead.id)
            .select();
        
        if (error) {
            console.log('First Update Failed (Expected):', error.message);
            // Retry logic from leads.js
            delete updates.assigned_staff_ids;
            console.log('Retrying with:', updates);
            const { data: data2, error: error2 } = await supabaseAdmin
                .from('leads')
                .update(updates)
                .eq('id', lead.id)
                .select();
            
            if (error2) {
                console.error('Retry Failed:', error2);
            } else {
                console.log('Retry Success:', data2);
            }
        } else {
            console.log('First Update Success (Unexpected):', data);
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

simulateLeadsJsUpdate();
