/**
 * STAGE CHANGE DRIP TRIGGER TEST
 * Simulates a Lead moving to a new Pipeline Stage and triggering the Drip.
 */

const DripTriggerService = {
    // Mocking Logic from DripTriggerService.js
    handleStageChanged: async (userId, lead, newStageId, campaign) => {
        console.log(`\n[Test] 🔄 Lead Match: ${lead.name} moved to Stage: ${newStageId}`);
        
        // 1. Resolve Contact (Lead should have phone or contact_id)
        const contactId = lead.contact_id || 'con-fake-123';
        console.log(`[Test] 🎯 Resolved Contact ID: ${contactId}`);

        // 2. Check Match
        const matches = campaign.trigger_type === 'pipeline_STAGE_CHANGED' && campaign.trigger_value === newStageId;
        
        if (matches && campaign.status === 'ACTIVE') {
            console.log(`[Test] ✨ Match found! Triggering Drip: "${campaign.name}"`);
            return enrollContact(userId, contactId, campaign);
        } else {
            console.log(`[Test] ❌ No active campaign matches stage: ${newStageId}`);
            return null;
        }
    }
};

function calculateDelay(startDate, value, unit) {
    const date = new Date(startDate);
    if (!value) return date;
    switch (unit) {
        case 'MINUTES': date.setMinutes(date.getMinutes() + value); break;
        case 'HOURS': date.setHours(date.getHours() + value); break;
        default: break;
    }
    return date;
}

function enrollContact(userId, contactId, campaign) {
    const firstStep = campaign.steps[0];
    const now = new Date();
    const nextRun = calculateDelay(now, firstStep.delay_value, firstStep.delay_unit);
    
    return {
        id: 'enr-stage-1',
        contact_id: contactId,
        next_run_at: nextRun,
        current_step: firstStep.id,
        status: 'ACTIVE'
    };
}

// SIMULATION DATA
const userCampaign = {
  "id": "4b67ae22-e1fd-48d3-80e0-2e8a038657b8",
  "name": "drip test (Stage Trigger)",
  "trigger_type": "pipeline_STAGE_CHANGED",
  "trigger_value": "1fcfd500-1b8b-4725-ab95-b8531e7930d3",
  "status": "ACTIVE",
  "steps": [
    { "id": "be8a8291", "step_order": 1, "delay_value": 15, "delay_unit": "MINUTES", "step_config": { "template_name": "uti" } }
  ]
};

const leadObj = {
    id: 'lead-001',
    name: 'Alice Smith',
    phone: '9876543210',
    contact_id: 'con-alice-001'
};

const targetStageId = "1fcfd500-1b8b-4725-ab95-b8531e7930d3";

async function runTest() {
    console.log('--- 🧪 STARTING STAGE CHANGE SIMULATION ---');

    console.log(`[Action] Moving Alice to Stage: ${targetStageId}`);
    
    // Triggering
    const enrollment = await DripTriggerService.handleStageChanged('u-1', leadObj, targetStageId, userCampaign);
    
    if (enrollment) {
        console.log(`[Result] ✅ Successfully enrolled Alice.`);
        console.log(`[Result] 🕒 First message scheduled for: ${enrollment.next_run_at.toISOString()}`);
        
        // Verifying delay (should be 15 mins)
        const diffMs = enrollment.next_run_at - new Date();
        const diffMins = Math.round(diffMs / 60000);
        console.log(`[Result] ⏱️ Verified Delay: ${diffMins} minutes (Expected: 15)`);
    }

    // Negative Test: Moving to a different stage
    console.log('\n[Action] Moving Alice to a different stage (cold-leads)...');
    const wrongEnrollment = await DripTriggerService.handleStageChanged('u-1', leadObj, "cold-stage-abc", userCampaign);
    if (!wrongEnrollment) {
        console.log('[Result] ✅ Correct behavior: No enrollment for non-matching stage.');
    }

    console.log('\n--- 🏁 STAGE CHANGE TEST COMPLETED ---');
}

runTest();
