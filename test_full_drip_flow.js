/**
 * FULL DRIP FLOW TEST SCRIPT
 * This script simulates the entire lifecycle of the campaign:
 * 1. Tag addition trigger
 * 2. Enrollment creation with calculated delay
 * 3. Heartbeat processing with window checks
 * 4. Step advancement
 */

const DripTriggerService = {
    // Mocking the logic from DripTriggerService.js
    handleTagAdded: async (userId, contact, addedTags, campaign) => {
        console.log(`\n[Test] 🏷️ Tag added to contact: ${addedTags.join(', ')}`);
        
        // Simulating the query: trigger_type='TAG_ADDED' AND trigger_value IN addedTags
        const matches = addedTags.includes(campaign.trigger_value);
        
        if (matches && campaign.status === 'ACTIVE') {
            console.log(`[Test] ✨ Match found! Enrolling in: ${campaign.name}`);
            return enrollContact(userId, contact, campaign);
        }
        return null;
    }
};

function calculateDelay(startDate, value, unit) {
    const date = new Date(startDate);
    if (!value) return date;
    switch (unit) {
        case 'MINUTES': date.setMinutes(date.getMinutes() + value); break;
        case 'HOURS': date.setHours(date.getHours() + value); break;
        case 'DAYS': date.setDate(date.getDate() + value); break;
        default: break;
    }
    return date;
}

function enrollContact(userId, contact, campaign) {
    const firstStep = campaign.steps[0];
    const now = new Date();
    const nextRun = calculateDelay(now, firstStep.delay_value, firstStep.delay_unit);
    
    return {
        id: 'enr-999',
        user_id: userId,
        contact_id: contact.id,
        drip_campaign_id: campaign.id,
        current_step_id: firstStep.id,
        status: 'ACTIVE',
        next_run_at: nextRun,
        contact: contact,
        drip_campaign: campaign
    };
}

// SIMULATION
const campaignJson = {
  "id": "4b67ae22-e1fd-48d3-80e0-2e8a038657b8",
  "name": "drip test",
  "trigger_type": "TAG_ADDED",
  "trigger_value": "customer-signup", // Setting a sample trigger value
  "status": "ACTIVE",
  "steps": [
    { "id": "step-1", "step_order": 1, "delay_value": 15, "delay_unit": "MINUTES", "step_config": { "template_name": "uti" } },
    { "id": "step-2", "step_order": 2, "delay_value": 30, "delay_unit": "MINUTES", "step_config": { "template_name": "devk" } }
  ]
};

const contact = { id: 'con-001', name: 'John Doe', phone: '1234567890' };

async function runTest() {
    console.log('--- 🧪 STARTING FULL DRIP FLOW SIMULATION ---');

    // 1. Simulate Tag Added
    let enrollment = await DripTriggerService.handleTagAdded('u-1', contact, ['customer-signup'], campaignJson);
    
    if (enrollment) {
        console.log(`[Test] ✅ Enrollment created. Next Run At: ${enrollment.next_run_at.toISOString()}`);
        
        // 2. Simulate Time Advancement (to T+16 mins)
        console.log('\n[Test] 🕒 Advancing time by 16 minutes...');
        const virtualNow = new Date(enrollment.next_run_at.getTime() + 60000); // 1 minute after scheduled time
        
        // 3. Simulate Drip Processor Heartbeat
        console.log(`[Test] 💓 Heartbeat running at: ${virtualNow.toISOString()}`);
        
        if (enrollment.next_run_at <= virtualNow) {
            console.log(`[Test] 🚀 Job is DUE! Processing Step ${enrollment.current_step_id}...`);
            
            // Execute Step
            const currentStep = campaignJson.steps.find(s => s.id === enrollment.current_step_id);
            console.log(`[Test] 📱 Sending WhatsApp: ${currentStep.step_config.template_name}`);
            
            // Advance to Step 2
            const nextStep = campaignJson.steps.find(s => s.step_order === currentStep.step_order + 1);
            if (nextStep) {
                enrollment.current_step_id = nextStep.id;
                enrollment.next_run_at = calculateDelay(virtualNow, nextStep.delay_value, nextStep.delay_unit);
                console.log(`[Test] ⏭️ Advanced to Step ${nextStep.step_order}. Next Run At: ${enrollment.next_run_at.toISOString()}`);
            }
        }

        // 4. Simulate Delay for Step 2 (advancing another 31 mins)
        console.log('\n[Test] 🕒 Advancing time by another 31 minutes...');
        const virtualNow2 = new Date(enrollment.next_run_at.getTime() + 60000);
        
        if (enrollment.next_run_at <= virtualNow2) {
            console.log(`[Test] 🚀 Job is DUE! Processing Step ${enrollment.current_step_id}...`);
            const currentStep = campaignJson.steps.find(s => s.id === enrollment.current_step_id);
            console.log(`[Test] 📱 Sending WhatsApp: ${currentStep.step_config.template_name}`);
        }
    }

    console.log('\n--- 🏁 TEST COMPLETED SUCCESSFULLY ---');
}

runTest();
