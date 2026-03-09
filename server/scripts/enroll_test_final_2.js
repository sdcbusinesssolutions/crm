
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function enrollTest() {
    try {
        console.log('Enrolling test contact...');
        const contactId = 'be3f3fb9-ae26-404e-8931-ed477bcd9a1f';
        const { data: campaign } = await supabase.from('drip_campaigns').select('id, user_id').ilike('name', 'newdrip').single();
        const { data: step } = await supabase.from('drip_steps').select('id').eq('drip_campaign_id', campaign.id).eq('step_order', 1).single();

        const { error } = await supabase.from('drip_enrollments').insert({
            user_id: campaign.user_id,
            contact_id: contactId,
            drip_campaign_id: campaign.id,
            current_step_id: step.id,
            status: 'ACTIVE',
            started_at: new Date().toISOString(),
            next_run_at: new Date().toISOString()
        });

        if (error) {
            console.error('Enrollment failed:', error.message);
        } else {
            console.log('✅ Test enrollment created successfully!');
        }
    } catch (e) { console.error(e); }
}
enrollTest();
