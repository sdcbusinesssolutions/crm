const { supabaseAdmin } = require('./lib/supabaseClient');

async function debug() {
    const campaignId = 'bd3d2bc8-69ba-4c96-a783-78597504f103';
    
    console.log('--- Campaign Details ---');
    const { data: campaign, error: cErr } = await supabaseAdmin
        .from('drip_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();
    
    if (cErr) {
        console.error('Error fetching campaign:', cErr);
    } else {
        console.log(JSON.stringify(campaign, null, 2));
    }

    console.log('\n--- Steps ---');
    const { data: steps, error: sErr } = await supabaseAdmin
        .from('drip_steps')
        .select('*')
        .eq('drip_campaign_id', campaignId)
        .order('step_order', { ascending: true });
    
    if (sErr) {
        console.error('Error fetching steps:', sErr);
    } else {
        console.log(`Found ${steps?.length || 0} steps.`);
        console.log(JSON.stringify(steps, null, 2));
    }

    console.log('\n--- Enrollments ---');
    const { data: enrollments, error: eErr } = await supabaseAdmin
        .from('drip_enrollments')
        .select('*')
        .eq('drip_campaign_id', campaignId);
    
    if (eErr) {
        console.error('Error fetching enrollments:', eErr);
    } else {
        console.log(`Found ${enrollments?.length || 0} enrollments.`);
        console.log(JSON.stringify(enrollments, null, 2));
    }
}

debug();
