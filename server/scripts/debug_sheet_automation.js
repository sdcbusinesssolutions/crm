const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');

// Mock Whatsapp Service before requiring SheetAutomationService
// Since we can't easily mock require, we'll just let it fail or we rely on the fact that 
// we only care about the logs generated BEFORE the API call.

const sheetService = require('../services/SheetAutomationService');

const AUTOMATION_ID = 'bdf1cfdf-f698-4372-bada-3a839dce9ea5';

async function debugAutomation() {
    // We can use the service's internal supabase or our own. 
    // The service uses `supabaseAdmin` from lib.

    // We need to fetch the auto using the service's client? 
    // No, we can just fetch it manually and pass it to sendMessage.

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: autos, error } = await supabaseAdmin
        .from('sheet_automations')
        .select('*')
        .eq('id', AUTOMATION_ID);

    if (error || !autos || autos.length === 0) {
        console.error('Error or No automation found:', error);
        return;
    }

    const auto = autos[0];
    console.log('Testing Automation:', auto.name);

    const rowObj = {
        "Name": "TestUser",
        "Phone": "911234567890",
        "Date": "20-Jan-2026"
    };

    console.log('--- STARTING SEND MESSAGE TEST ---');
    try {
        await sheetService.sendMessage(auto, rowObj);
    } catch (e) {
        console.log('Expected error (API call failed):', e.message);
    }
    console.log('--- TEST FINISHED ---');
}

debugAutomation();
