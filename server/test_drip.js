require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { processSingleEnrollment } = require('./workers/dripProcessor');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function runTest() {
    try {
        console.log('--- DRIP TEST STARTED ---');
        
        // 1. Get Campaign
        const { data: campaign } = await supabase
            .from('drip_campaigns')
            .select('*, steps:drip_steps(*)')
            .eq('name', 'manual-drip-today')
            .single();

        if (!campaign) {
            console.error('Campaign not found: manual-drip-today');
            return;
        }
        console.log('Campaign:', campaign.name, 'with Steps:', campaign.steps.length);
        
        // 2. Get Contact
        let contact;
        const { data: devContact } = await supabase
            .from('contacts')
            .select('*')
            .eq('phone', '918408907516')
            .maybeSingle();
        
        contact = devContact;

        if (!contact) {
             const { data: latestContacts } = await supabase.from('contacts').select('*').limit(1).order('created_at', { ascending: false });
             contact = latestContacts?.[0];
        }

        if (!contact) {
             console.error('No contacts found in DB');
             return;
        }
        console.log('Enrolling contact:', contact.name);

        // 3. Clear existing enrollments for this contact in this campaign
        await supabase
            .from('drip_enrollments')
            .delete()
            .eq('drip_campaign_id', campaign.id)
            .eq('contact_id', contact.id);

        // 4. Enroll manually
        const firstStep = campaign.steps.sort((a,b) => a.step_order - b.step_order)[0];
        const { data: enrollment, error: eErr } = await supabase
            .from('drip_enrollments')
            .insert({
                drip_campaign_id: campaign.id,
                contact_id: contact.id,
                current_step_id: firstStep.id,
                status: 'ACTIVE',
                started_at: new Date(),
                next_run_at: new Date() // Start now!
            })
            .select()
            .single();

        if (eErr || !enrollment) {
            console.error('Enrollment failed:', eErr);
            return;
        }
        console.log('Enrollment created! ID:', enrollment.id);

        // 5. Process Step 1
        console.log('--- Processing Step 1 ---');
        const envWithRelations = {
            ...enrollment,
            drip_campaign: campaign,
            current_step: firstStep,
            contact: contact
        };
        await processSingleEnrollment(envWithRelations, new Date());
        
        // 6. Check results
        const { data: results } = await supabase
            .from('drip_enrollments')
            .select('*, logs:drip_logs(*)')
            .eq('id', enrollment.id)
            .single();

        console.log('Final Status:', results.status);
        console.log('Logs:', results.logs.map(l => l.action_type).join(', '));
        
        console.log('--- TEST FINISHED ---');
    } catch (err) {
        console.error('Test error:', err);
    }
}

runTest();
