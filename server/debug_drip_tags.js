/**
 * DRIP CAMPAIGN TAG ENROLLMENT DIAGNOSTIC
 * Campaign ID: bd3d2bc8-69ba-4c96-a783-78597504f103
 * User ID:     38edee2f-04c5-4f4c-8ca1-baed6ed84711
 * Tag:         abc
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ FATAL: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CAMPAIGN_ID  = 'bd3d2bc8-69ba-4c96-a783-78597504f103';
const USER_ID      = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
const TRIGGER_TAG  = 'abc';

async function run() {
    console.log('\n==============================');
    console.log(' DRIP TAG ENROLLMENT DEBUGGER');
    console.log('==============================\n');

    // ── 1. CAMPAIGN STATE ────────────────────────────────────────────────────
    console.log('--- [1] Campaign State ---');
    const { data: campaign, error: cErr } = await supabase
        .from('drip_campaigns')
        .select('id, name, status, trigger_type, trigger_value, allow_reentry')
        .eq('id', CAMPAIGN_ID)
        .single();

    if (cErr) { console.error('Campaign query error:', cErr.message); process.exit(1); }
    console.log('Campaign:', JSON.stringify(campaign, null, 2));

    // ── 2. CAMPAIGN STEPS ────────────────────────────────────────────────────
    console.log('\n--- [2] Campaign Steps ---');
    const { data: steps } = await supabase
        .from('drip_steps')
        .select('id, step_order, step_type, delay_value, delay_unit')
        .eq('drip_campaign_id', CAMPAIGN_ID)
        .order('step_order');
    console.log('Steps:', JSON.stringify(steps, null, 2));

    // ── 3. ALL CONTACTS – FIRST 2000 ROWS (chunked) ──────────────────────────
    console.log('\n--- [3] Scanning ALL contacts for user ---');
    let allContacts = [];
    let page = 0;
    const SIZE = 1000;
    while (true) {
        const from = page * SIZE;
        const { data: chunk, error: chErr } = await supabase
            .from('contacts')
            .select('id, name, phone, tags')
            .eq('user_id', USER_ID)
            .range(from, from + SIZE - 1);
        if (chErr) { console.error('Contact fetch error:', chErr.message); break; }
        if (!chunk || chunk.length === 0) break;
        allContacts = allContacts.concat(chunk);
        console.log(`  Fetched chunk ${page + 1}: ${chunk.length} contacts (total so far: ${allContacts.length})`);
        if (chunk.length < SIZE) break;
        page++;
    }
    console.log(`Total contacts for user: ${allContacts.length}`);

    // ── 4. FIND TAG MATCHES ──────────────────────────────────────────────────
    console.log(`\n--- [4] Contacts whose tags[] contain '${TRIGGER_TAG}' ---`);
    const matches = allContacts.filter(c => {
        const tags = Array.isArray(c.tags) ? c.tags : [];
        return tags.some(t => typeof t === 'string' && t.trim().toLowerCase() === TRIGGER_TAG.toLowerCase());
    });
    console.log(`Matches: ${matches.length}`);
    matches.forEach(m => {
        console.log(`  ✅ ${m.name} | ${m.phone} | tags: ${JSON.stringify(m.tags)}`);
    });

    // Show a sample of tags across ALL contacts to detect format issues
    console.log('\n--- [5] Sample tags from first 20 contacts (format check) ---');
    allContacts.slice(0, 20).forEach(c => {
        if (c.tags && c.tags.length > 0) {
            console.log(`  ${c.name} | tags: ${JSON.stringify(c.tags)} | types: ${c.tags.map(t => typeof t).join(',')}`);
        }
    });

    // ── 6. EXISTING ENROLLMENTS ──────────────────────────────────────────────
    console.log('\n--- [6] Existing enrollments for campaign ---');
    const { data: enrollments, error: eErr } = await supabase
        .from('drip_enrollments')
        .select(`
            id, contact_id, status, current_step_id,
            contacts(name, phone),
            current_step:drip_steps!drip_enrollments_current_step_id_fkey(step_order)
        `)
        .eq('drip_campaign_id', CAMPAIGN_ID);

    if (eErr) console.error('Enrollment query error:', eErr.message);
    console.log(`Total enrollments: ${enrollments?.length || 0}`);
    (enrollments || []).forEach(e => {
        console.log(`  - ${e.contacts?.name} (${e.contacts?.phone}) | status: ${e.status} | step: ${e.current_step?.step_order ?? 'null (completed)'} | enrollment_id: ${e.id}`);
    });

    // ── 7. MATCH vs ALREADY ENROLLED ─────────────────────────────────────────
    console.log('\n--- [7] Who is NOT yet enrolled (should be synced) ---');
    const enrolledIds = new Set((enrollments || []).map(e => e.contact_id));
    const enrolledPhones = new Set();
    (enrollments || []).forEach(e => { if (e.contacts?.phone) enrolledPhones.add(e.contacts.phone.trim()); });

    const missing = matches.filter(c => {
        return !enrolledIds.has(c.id) && !(c.phone && enrolledPhones.has(c.phone.trim()));
    });
    console.log(`Contacts with tag but NOT enrolled: ${missing.length}`);
    missing.forEach(m => console.log(`  ⚠️  ${m.name} | ${m.phone} | id: ${m.id}`));

    // ── 8. CONCLUSION ─────────────────────────────────────────────────────────
    console.log('\n--- [8] CONCLUSION ---');
    if (matches.length === 0) {
        console.log('❌ PROBLEM: No contacts found with tag "abc". Check if tag is stored differently (maybe as tag ID, not name).');
        // Show sample raw data
        console.log('\nRaw tags from first 5 contacts:');
        allContacts.slice(0, 5).forEach(c => console.log(`  ${c.name}: ${JSON.stringify(c.tags)}`));
    } else if (missing.length === 0) {
        console.log('✅ All matching contacts are already enrolled. Nothing to sync.');
        console.log('   → Check "allow_reentry" or delete existing COMPLETED enrollments to re-enroll.');
    } else {
        console.log(`✅ Found ${missing.length} contacts to enroll. Sync logic should pick these up.`);
        console.log('   → Possible bug: sync endpoint not being hit, or error thrown silently.');
    }

    console.log('\n✅ Diagnostic complete.\n');
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
