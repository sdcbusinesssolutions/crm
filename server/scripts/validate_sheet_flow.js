
require('dotenv').config({ path: 'f:/whatsapp/Final-Project-Wp/wpcode/.env' });
const { supabaseAdmin } = require('../lib/supabaseClient');
const flowEngine = require('../services/flowEngine');
const SheetAutomationService = require('../services/SheetAutomationService');
const fs = require('fs');

async function testSheetFlow() {
    console.log('--------------------------------------------------');
    console.log('--- TEST START: Validating Sheet Trigger Flow ---');
    console.log('--------------------------------------------------');

    const flowId = '2c6943aa-719c-45e3-9917-98c2d4682141';
    const contactPhone = '918408907516'; // Dev
    const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';

    // 1. Fetch Flow to Verify Structure
    console.log('1. Fetching Flow from DB...');
    const { data: flow, error } = await supabaseAdmin.from('flows').select('*').eq('id', flowId).single();
    if (error || !flow) {
        console.error('CRITICAL: Flow not found!', error);
        return;
    }
    console.log(`   Flow Found: ${flow.name}`);
    console.log(`   Nodes Count: ${flow.nodes.length}`);

    // 2. Find Sheet Trigger Node
    const sheetNode = flow.nodes.find(n => n.type === 'sheetTrigger');
    if (!sheetNode) {
        console.error('CRITICAL: No sheetTrigger node found in this flow.');
        // console.log('Nodes available:', flow.nodes.map(n => n.type));
    } else {
        console.log(`   ✅ Found SheetTrigger Node: ${sheetNode.id}`);
    }

    // 3. Mock Sheet Data
    const rowObj = {
        "Name": "TestUser",
        "Phone": contactPhone,
        "Date": "25-Jan-2026",
        "status": ""
    };

    // 4. Test Flow Execution (Simulate SheetAutomationService logic)
    console.log('2. Simulating Flow Execution...');
    try {
        const initialContext = {
            ...rowObj,
            trigger: { ...rowObj },
            source: 'google_sheet'
        };

        const safePhone = contactPhone.replace(/[^\d+]/g, '');

        // Explicitly calling startFlow just like the Service would
        await flowEngine.startFlow(userId, safePhone, flow, initialContext, sheetNode ? sheetNode.id : null);
        console.log('   ✅ Flow Start Signal Sent.');
    } catch (e) {
        console.error('   ❌ Execution Failed:', e);
    }

    // 5. Test Status Write (Simulate SheetAutomationService.writeStatus)
    console.log('3. Validate Status Write (Axios Check)...');
    try {
        // We need a real automation object to test writeStatus, 
        // let's grab one active sheet automation to get credentials
        const { data: auto } = await supabaseAdmin.from('sheet_automations').select('*').limit(1).single();
        if (auto) {
            console.log(`   Using Automation credentials from: ${auto.name}`);
            const authClient = await SheetAutomationService.getAuthClient(auto.user_id, auto.connection_id);
            // Try to write to a dummy cell or just verify client works
            console.log('   ✅ Credentials Retrieved via Axios logic.');
            // await SheetAutomationService.writeStatus(authClient, auto.spreadsheet_id, auto.sheet_name, 2, 4, 'TEST_WRITE');
        } else {
            console.log('   Skipping real write test (no automation found).');
        }
    } catch (e) {
        console.error('   ❌ Status Write Logic Check Failed:', e.message);
    }
    console.log('--------------------------------------------------');
    console.log('--- TEST COMPLETE ---');
    console.log('--------------------------------------------------');
}

testSheetFlow();
