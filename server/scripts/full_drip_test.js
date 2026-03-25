
const { supabaseAdmin: supabase } = require('../lib/supabaseClient');
const { processDrips, processSingleEnrollment } = require('../workers/dripProcessor');

async function main() {
    console.log('--- STARTING FULL DRIP FLOW TEST ---');

    // 1. Create Test Contact
    const testPhone = '9999999999';
    const testEmail = 'antigravity_test@example.com';
    const testName = 'Antigravity Test Agent';

    const userId = 'a67982f4-b24a-4c67-9378-ecdb0ed42e5c'; // Confirmed Existing User ID

    let { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', testPhone)
        .maybeSingle();

    if (!contact) {
        console.log('Creating test contact...');
        const { data: newContact, error: createError } = await supabase
            .from('contacts')
            .insert({
                name: testName,
                phone: testPhone,
                email: testEmail,
                user_id: userId
            })
            .select()
            .single();
        if (createError) throw createError;
        contact = newContact;
    } else {
        console.log('Using existing test contact:', contact.id);
        // Ensure email is set
        await supabase.from('contacts').update({ email: testEmail, name: testName }).eq('id', contact.id);
    }

    // 2. Clear previous enrollments for this contact to avoid interference
    await supabase.from('drip_enrollments').delete().eq('contact_id', contact.id);
    console.log('Cleared previous enrollments.');

    const campaignId = '4b67ae22-e1fd-48d3-80e0-2e8a038657b8'; // "drip test"

    // 3. Add a temporary EMAIL step if it doesn't have one
    const { data: existingEmailStep } = await supabase
        .from('drip_steps')
        .select('id')
        .eq('drip_campaign_id', campaignId)
        .eq('step_type', 'EMAIL')
        .maybeSingle();

    let stepId;
    if (!existingEmailStep) {
        console.log('Adding test EMAIL step to campaign...');
        const { data: newStep, error: stepError } = await supabase
            .from('drip_steps')
            .insert({
                drip_campaign_id: campaignId,
                step_order: 99, // High order so it comes after others if any
                step_type: 'EMAIL',
                step_config: {
                    provider: 'SMTP',
                    connectionId: 'c8382798-2fb0-4966-8361-b1e19488da15', // SMTP connection ID
                    subject: 'Hello {{contact.name}}!',
                    body: 'This is a test drip for {{contact.email}}. Success!',
                    to: '{{contact.email}}'
                },
                delay_value: 0,
                delay_unit: 'MINUTES'
            })
            .select()
            .single();
        if (stepError) throw stepError;
        stepId = newStep.id;
    } else {
        console.log('Using existing EMAIL step:', existingEmailStep.id);
        stepId = existingEmailStep.id;
        // Update it to use variables
        await supabase.from('drip_steps').update({
            step_config: {
                provider: 'SMTP',
                connectionId: 'c8382798-2fb0-4966-8361-b1e19488da15',
                subject: 'Hello {{contact.name}}!',
                body: 'This is a test drip for {{contact.email}}. Success!',
                to: '{{contact.email}}'
            }
        }).eq('id', stepId);
    }

    // 4. Temporarily open delivery window
    console.log('Opening delivery window for test...');
    const { data: originalCampaign } = await supabase.from('drip_campaigns').select('time_window_start, time_window_end').eq('id', campaignId).single();
    await supabase.from('drip_campaigns').update({ time_window_start: '00:00', time_window_end: '23:59' }).eq('id', campaignId);

    // 5. Enroll contact
    console.log('Enrolling contact in sequence...');
    const { data: enrollmentRow, error: enrollError } = await supabase
        .from('drip_enrollments')
        .insert({
            drip_campaign_id: campaignId,
            contact_id: contact.id,
            current_step_id: stepId, // Start specifically at our email step for quick test
            status: 'ACTIVE',
            next_run_at: new Date(Date.now() - 3600000).toISOString() // 1 hour in the past
        })
        .select()
        .single();
    if (enrollError) throw enrollError;
    console.log('Enrollment created:', enrollmentRow.id);

    // 6. Fetch Join Data Manually
    const { data: enrollment } = await supabase
        .from('drip_enrollments')
        .select('*, drip_campaign:drip_campaigns(*), current_step:drip_steps!drip_enrollments_current_step_id_fkey(*), contact:contacts(*)')
        .eq('id', enrollmentRow.id)
        .single();

    // 7. Run Processor For this specific enrollment
    console.log('Executing step processing manually...');
    await processSingleEnrollment(enrollment);

    console.log('--- TEST CYCLE COMPLETE ---');

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
