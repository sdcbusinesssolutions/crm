
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function enrollTest() {
    try {
        console.log('Enrolling test contact...');
        const phone = '918408907516'; // User's test number
        const { data: contact } = await supabase.from('contacts').select('id').eq('phone', phone).single();
        if (!contact) {
            console.log('Contact with phone 918408907516 not found.');
            return;
        }

        const { data: campaign } = await supabase.from('drip_campaigns').select('id').ilike('name', 'newdrip').single();
        if (!campaign) {
            console.log('Campaign "newdrip" not found.');
            return;
        }

        const { data: step } = await supabase.from('drip_steps').select('id').eq('drip_campaign_id', campaign.id).eq('step_order', 1).single();

        // Enroll now with status ACTIVE and next_run_at = NOW
        const { data, error } = await supabase.from('drip_enrollments').insert({
            user_id: 'e4eaeb1c-6d21-4ea2-8b50-ac1b8bdf106d', // Should use the correct user_id
            contact_id: contact.id,
            drip_campaign_id: campaign.id,
            current_step_id: step.id,
            status: 'ACTIVE',
            started_at: new Date().toISOString(),
            next_run_at: new Date().toISOString()
        }).select();

        if (error) {
            console.error('Enrollment failed:', error.message);
        } else {
            console.log('✅ Test enrollment created successfully! ID:', data[0].id);
            console.log('The engine should process this within 60 seconds.');
        }
    } catch (e) {
        console.error('Error:', e);
    }
}
enrollTest();
