const { supabaseAdmin: supabase } = require('../lib/supabaseClient');
const { processSingleEnrollment } = require('../workers/dripProcessor');

async function main() {
    console.log('--- STARTING USER SPECIFIC DRIP TEST ---');

    const testPhone = '910000000000';
    const ownerPhone = '918408907516';
    const campaignId = '4b67ae22-e1fd-48d3-80e0-2e8a038657b8'; // "drip test"
    const userId = 'a67982f4-b24a-4c67-9378-ecdb0ed42e5c'; // User ID from campaign

    // 1. Ensure Contact Exists
    let { data: contact } = await supabase.from('contacts').select('id').eq('phone', testPhone).maybeSingle();
    if (!contact) {
        console.log('Creating test contact 910000000000...');
        const { data: n, error: e } = await supabase.from('contacts').insert({
            name: 'Deepak Sharma (Test)',
            phone: testPhone,
            email: 'deepak_test@example.com',
            user_id: userId
        }).select().single();
        if (e) throw e;
        contact = n;
    } else {
        console.log('Using existing contact:', contact.id);
    }

    // 2. Clear previous enrollments for this contact for a clean test
    await supabase.from('drip_enrollments').delete().eq('contact_id', contact.id);

    // 3. Fetch first step
    const { data: step } = await supabase
        .from('drip_steps')
        .select('*')
        .eq('drip_campaign_id', campaignId)
        .order('step_order', { ascending: true })
        .limit(1)
        .single();
    
    console.log('First step identified:', step.id, 'Order:', step.step_order);

    // 4. Temporarily open delivery window
    console.log('Opening delivery window for test...');
    const { data: originalCampaign } = await supabase.from('drip_campaigns').select('time_window_start, time_window_end').eq('id', campaignId).single();
    await supabase.from('drip_campaigns').update({ time_window_start: '00:00', time_window_end: '23:59' }).eq('id', campaignId);

    // 5. Enroll Contact with Notification Rule
    // Trigger notification: stop_at 30 mins away, rule 1 hour away (30m <= 60m = TRUE)
    const stopAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const notificationRules = [{
        phone: ownerPhone,
        value: 1,
        unit: 'HOURS'
    }];

    console.log('Enrolling contact with stop_at:', stopAt);
    const { data: enrollmentRow, error: enrollError } = await supabase
        .from('drip_enrollments')
        .insert({
            drip_campaign_id: campaignId,
            contact_id: contact.id,
            current_step_id: step.id,
            status: 'ACTIVE',
            next_run_at: new Date(Date.now() - 3600000).toISOString(),
            stop_at: stopAt,
            notification_rules: notificationRules
        })
        .select()
        .single();
    
    if (enrollError) throw enrollError;
    console.log('Enrollment created:', enrollmentRow.id);

    // 6. Fetch Join Data
    const { data: enrollment } = await supabase
        .from('drip_enrollments')
        .select('*, drip_campaign:drip_campaigns(*), current_step:drip_steps!drip_enrollments_current_step_id_fkey(*), contact:contacts(*)')
        .eq('id', enrollmentRow.id)
        .single();

    // 7. Cycle Test
    console.log('--- RE-PROCESSING ENROLLMENT ---');
    await processSingleEnrollment(enrollment);

    console.log('--- TEST FINISHED ---');

    console.log('Restoring delivery window...');
    await supabase.from('drip_campaigns').update({
        time_window_start: originalCampaign.time_window_start,
        time_window_end: originalCampaign.time_window_end
    }).eq('id', campaignId);
}

main().catch(err => {
    console.error('TEST FAILED:', err);
    process.exit(1);
});
