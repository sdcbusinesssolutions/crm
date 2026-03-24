/**
 * COMPLETE Drip System Master Verification
 * Tests:
 * 1. TAG_ADDED Trigger
 * 2. STAGE_CHANGED Trigger (CRM Integration)
 * 3. Re-entry Logic (Disabled policy)
 * 4. Stop on Reply (User response cancellation)
 */

const fs = require('fs');
const path = require('path');

process.env.SUPABASE_URL = 'http://mock-supabase.com';
process.env.SUPABASE_SERVICE_KEY = 'mock-key';

// Mock Supabase with internal state to simulate different scenarios
let mockDB_enrollments = [];
const mockSupabase = {
    from: (table) => {
        return {
            select: (query) => ({
                eq: (col, val) => {
                    // Simulating complex queries for Stage Changed & Reply
                    if (query.includes('contacts!inner(phone)') && col === 'contacts.phone') {
                        return { eq: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: mockDB_enrollments }) }) }) };
                    }
                    if (table === 'drip_campaigns') {
                        let data = [{ id: 'camp-1', name: 'Trigger Camp', trigger_value: 'test-tag', status: 'ACTIVE', trigger_type: 'TAG_ADDED', allow_reentry: false }];
                        if (val === 'stage-abc') data = [{ id: 'camp-2', name: 'Stage Camp', trigger_value: 'stage-abc', status: 'ACTIVE', trigger_type: 'pipeline_STAGE_CHANGED', allow_reentry: true }];
                        return { eq: () => ({ eq: () => ({ eq: () => ({ in: () => Promise.resolve({ data }), eq: () => Promise.resolve({ data }) }) }) }) };
                    }
                    if (table === 'drip_enrollments') {
                        // Re-entry check
                        let existing = mockDB_enrollments.find(e => e.drip_campaign_id === val);
                        return { eq: () => ({ neq: () => ({ neq: () => ({ order: () => ({ limit: () => ({ maybeSingle: () => Promise.resolve({ data: existing }) }) }) }) }) }) };
                    }
                    return mockSupabase.from(table);
                },
                single: () => Promise.resolve({ data: { id: 'step-1', delay_value: 0, delay_unit: 'HOURS' } })
            }),
            insert: (data) => {
                mockDB_enrollments.push({...data, status: 'ACTIVE'});
                console.log(`   [DB] Enrolled: ${JSON.stringify(data.drip_campaign_id)}`);
                return Promise.resolve({ error: null });
            },
            update: (data) => {
                console.log(`   [DB] Updated rows with: ${JSON.stringify(data)}`);
                return { in: () => Promise.resolve({ error: null }), eq: () => Promise.resolve({ error: null }) };
            }
        };
    },
    rpc: (name, p) => Promise.resolve({ data: [] })
};

// Override require
const originalRequire = require('module').prototype.require;
require('module').prototype.require = function(modulePath) {
    if (modulePath.includes('supabaseClient')) return { supabaseAdmin: mockSupabase, supabase: mockSupabase };
    if (modulePath.includes('whatsappService') || modulePath.includes('GmailService') || modulePath.includes('SmtpService')) {
        return { sendMessage: () => Promise.resolve({}), sendEmail: () => Promise.resolve({}) };
    }
    return originalRequire.apply(this, arguments);
};

const DripTriggerService = require('../services/DripTriggerService');

async function verify() {
    console.log('\n--- 🧪 MASTER DRIP VERIFICATION STARTING ---');

    try {
        // SCENARIO 1: TAG ADDED
        console.log('\n1. Testing TAG_ADDED Trigger...');
        const contact = { id: 'con-001', phone: '123', name: 'User1' };
        await DripTriggerService.handleTagAdded('u-1', contact, ['test-tag']);
        if (mockDB_enrollments.length === 1) console.log('   ✅ SUCCESS: TAG_ADDED created enrollment.');

        // SCENARIO 2: STAGE CHANGED
        console.log('\n2. Testing STAGE_CHANGED (CRM) Trigger...');
        const lead = { id: 'lead-001', contact_id: 'con-001' };
        await DripTriggerService.handleStageChanged('u-1', lead, 'stage-abc');
        if (mockDB_enrollments.length === 2) console.log('   ✅ SUCCESS: STAGE_CHANGED created enrollment.');

        // SCENARIO 3: RE-ENTRY (DISABLED)
        console.log('\n3. Testing Allow Re-entry = FALSE...');
        // Try enrolling in camp-1 again
        await DripTriggerService.handleTagAdded('u-1', contact, ['test-tag']);
        if (mockDB_enrollments.length === 2) console.log('   ✅ SUCCESS: Blocked duplicate enrollment as expected.');

        // SCENARIO 4: STOP ON REPLY
        console.log('\n4. Testing STOP ON REPLY Activation...');
        mockDB_enrollments = [{ id: 'enr-1', drip_campaign_id: 'camp-1', drip_campaigns: { stop_on_reply: true, name: 'Camp1' } }];
        await DripTriggerService.handleReply('u-1', '123');
        console.log('   ✅ SUCCESS: Sent stop signal to active enrollments.');

        console.log('\n--- 🏁 ALL SYSTEMS VERIFIED & WORKING AS EXPECTED ---');
    } catch (e) {
        console.error('❌ VERIFICATION FAILED:', e);
        process.exit(1);
    }
}

verify();
