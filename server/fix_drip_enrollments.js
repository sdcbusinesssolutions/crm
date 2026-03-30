/**
 * ONE-TIME ENROLLMENT FIX
 * Enrolls the 4 missing contacts (deduplicated by phone) into campaign tagtrigger
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const CAMPAIGN_ID = 'bd3d2bc8-69ba-4c96-a783-78597504f103';
const USER_ID = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
const STEP_ID = 'e8a6458d-225e-4497-befb-968de82ebf6c';

// The 4 contacts found — deduplicated by phone: use ONE contact per phone
// Phone 917857836481 -> use fe9c4acd (first one)
// Phone 918408907516 -> use 7d6551ba (first one)
const TO_ENROLL = [
    { id: 'fe9c4acd-5b42-4fd9-b309-9857a8630fe4', phone: '917857836481', name: 'koshik Marketing' },
    { id: '7d6551ba-bda3-4e93-bb8d-563a90f62263', phone: '918408907516', name: 'dev' },
];

async function fix() {
    console.log('--- Enrolling missing contacts ---\n');

    for (const contact of TO_ENROLL) {
        // Check if already enrolled (any status)
        const { data: existing } = await supabase
            .from('drip_enrollments')
            .select('id, status')
            .eq('drip_campaign_id', CAMPAIGN_ID)
            .eq('contact_id', contact.id)
            .limit(1)
            .maybeSingle();

        if (existing) {
            console.log(`SKIP: ${contact.name} already enrolled (status: ${existing.status})`);
            continue;
        }

        const now = new Date();
        const nextRun = new Date(now.getTime() + 3 * 60 * 1000); // 3 minutes from now

        const { error } = await supabase.from('drip_enrollments').insert({
            drip_campaign_id: CAMPAIGN_ID,
            contact_id: contact.id,
            current_step_id: STEP_ID,
            status: 'ACTIVE',
            started_at: now.toISOString(),
            next_run_at: nextRun.toISOString(),
            is_looping: false,
        });

        if (error) {
            console.error(`❌ FAILED to enroll ${contact.name}: ${error.message}`);
        } else {
            console.log(`✅ Enrolled: ${contact.name} (${contact.phone})`);
        }
    }

    console.log('\n--- Verifying final enrollment state ---');
    const { data: enrollments } = await supabase
        .from('drip_enrollments')
        .select(`id, contact_id, status, contacts(name, phone), current_step:drip_steps!drip_enrollments_current_step_id_fkey(step_order)`)
        .eq('drip_campaign_id', CAMPAIGN_ID);

    console.log(`Total enrollments: ${enrollments?.length}`);
    enrollments?.forEach(e => {
        console.log(`  ${e.contacts?.name} | ${e.contacts?.phone} | status: ${e.status} | step: ${e.current_step?.step_order ?? 'null=completed'}`);
    });
}

fix().catch(e => { console.error('FATAL:', e); process.exit(1); });
