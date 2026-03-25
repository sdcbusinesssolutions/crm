const { supabaseAdmin: supabase } = require('../lib/supabaseClient');
const { processSingleEnrollment } = require('../workers/dripProcessor');

async function runTest() {
    console.log('🚀 [DRIP_TEST] Starting Confidence Test for Deepak Sharma');
    
    const contactPhone = '919373393645';
    const ownerPhone = '918408907516';
    const campaignId = '4b67ae22-e1fd-48d3-80e0-2e8a038657b8'; // "drip test"
    const userId = 'a67982f4-b24a-4c67-9378-ecdb0ed42e5c';

    // 1. Cleanup
    console.log('🧹 Cleaning up old data...');
    const { data: oldContacts } = await supabase.from('contacts').select('id').eq('phone', contactPhone);
    if (oldContacts) {
        for (const c of oldContacts) {
            await supabase.from('drip_enrollments').delete().eq('contact_id', c.id);
            await supabase.from('contacts').delete().eq('id', c.id);
        }
    }

    // 2. Create Fresh Contact
    console.log('👤 Creating contact: 919373393645');
    const { data: contact, error: cErr } = await supabase.from('contacts').insert({
        name: 'Deepak Test',
        phone: contactPhone,
        user_id: userId
    }).select().single();
    if (cErr) throw cErr;

    // 3. Setup Enrollment with Notification
    // Rule: Notify owner 1 hour before expiration.
    // Setting stop_at to 30 mins from now.
    const stopAt = new Date(Date.now() + 30 * 60 * 1000);
    const notificationRules = [{ phone: ownerPhone, value: 1, unit: 'HOURS' }];

    console.log(`📋 Enrolling in '${campaignId}' with StopAt: ${stopAt.toLocaleTimeString()}`);
    console.log(`🔔 Owner Notification set to: ${ownerPhone} (Threshold: 1h)`);

    const { data: firstStep } = await supabase.from('drip_steps').select('id').eq('drip_campaign_id', campaignId).order('step_order', { ascending: true }).limit(1).single();

    const { data: enrollmentRow, error: eErr } = await supabase.from('drip_enrollments').insert({
        drip_campaign_id: campaignId,
        contact_id: contact.id,
        current_step_id: firstStep.id,
        status: 'ACTIVE',
        next_run_at: new Date(Date.now() - 60000).toISOString(),
        stop_at: stopAt.toISOString(),
        notification_rules: notificationRules
    }).select().single();
    if (eErr) throw eErr;

    // 4. Force Window Open
    await supabase.from('drip_campaigns').update({ time_window_start: '00:00', time_window_end: '23:59' }).eq('id', campaignId);

    // 5. Fetch and Run
    const { data: enrollment } = await supabase
        .from('drip_enrollments')
        .select('*, drip_campaign:drip_campaigns(*), current_step:drip_steps!drip_enrollments_current_step_id_fkey(*), contact:contacts(*)')
        .eq('id', enrollmentRow.id)
        .single();

    console.log('⚙️ Executing Drip Cycle...');
    // We expect 2 things: 
    // 1. Owner Notification SENT (because 30m <= 1h)
    // 2. Step 1 Action (st1 WhatsApp) Logic executed
    await processSingleEnrollment(enrollment);

    // 6. Verify Logs
    const { data: logs } = await supabase.from('drip_logs').select('*').eq('drip_enrollment_id', enrollmentRow.id);
    console.log('\n--- EXECUTION LOGS ---');
    logs.forEach(l => {
        console.log(`[${l.action_type}] ${JSON.stringify(l.details)}`);
    });

    console.log('\n✅ TEST FINISHED');
}

runTest().catch(console.error);
