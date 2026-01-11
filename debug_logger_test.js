const { logCampaignRequest, logInboxMessage, logFlowEvent, logOnboardingEvent, overrideConsole } = require('./server/utils/logger');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Logger ---');
console.log('Log Directory:', path.join(__dirname, 'server/logs'));

// 1. Test Console Override
overrideConsole();
console.log('This is a test INFO log from debug script');
console.error('This is a test ERROR log from debug script');

// 2. Test Campaign Log
console.log('Writing Campaign Log...');
try {
    logCampaignRequest('TEST_EVENT', { foo: 'bar', timestamp: new Date().toISOString() });
    console.log('Campaign Log Write Attempted.');
} catch (e) {
    console.error('Campaign Log Failed:', e);
}

// 3. Test Inbox Log
console.log('Writing Inbox Log...');
try {
    logInboxMessage('TEST_INBOX', { message: 'hello', from: '123' });
    console.log('Inbox Log Write Attempted.');
} catch (e) {
    console.error('Inbox Log Failed:', e);
}

// 4. Test Flow Log
console.log('Writing Flow Log...');
try {
    logFlowEvent('TEST_FLOW', { flow_id: 'flow_123' });
    console.log('Flow Log Write Attempted.');
} catch (e) {
    console.error('Flow Log Failed:', e);
}

// 5. Test Onboarding Log
console.log('Writing Onboarding Log...');
try {
    logOnboardingEvent('TEST_ONBOARDING', { step: '1' });
    console.log('Onboarding Log Write Attempted.');
} catch (e) {
    console.error('Onboarding Log Failed:', e);
}

// Check if files exist
const logs = fs.readdirSync(path.join(__dirname, 'server/logs'));
console.log('Current Log Files:', logs);
