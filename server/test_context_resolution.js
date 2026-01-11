const contextManager = require('./services/flow/context');

const context = {
    // Variable stored at ROOT (simulating Flow Engine behavior)
    'user_name': {
        type: 'image',
        url: 'https://example.com/image.jpg',
        caption: 'Test Caption'
    },
    // Another variable stored under a specific Node ID (simulating structured storage)
    'otherNode': {
        'data': 'value'
    }
};

const pathsToTest = [
    'user_name.url',                      // Direct Access (Should work)
    'askInput-123.user_name.url',         // Node-Prefixed Access (Should work via Path Shifting)
    'askInput-123.user_name.caption',     // Node-Prefixed Access (Should work via Path Shifting)
    'randomNode.user_name.type',          // Random Prefix (Should work via Path Shifting)
    'otherNode.data',                     // Direct Nested (Should work)
    'askInput-123.missingVar'             // Missing (Should be undefined)
];

console.log('--- Context Logic Validation ---');
pathsToTest.forEach(path => {
    const value = contextManager.resolve(`{{${path}}}`, context);
    console.log(`Path: "${path}" => Resolved: "${value}"`);
});
