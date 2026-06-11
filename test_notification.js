const notificationEngine = require('./server/services/notificationEngine');
const { supabaseAdmin } = require('./server/lib/supabaseClient');

async function runTest() {
    console.log('Testing NotificationEngine with Webhook...');
    
    // Simulate a signup event for cloudospire.in
    const domain = 'cloudospire.in';
    const userData = {
        id: 'test-user-id-123',
        name: 'John Doe Test',
        email: 'john@example.com',
        contact_number: '1234567890'
    };

    // Temporarily mock the db response or mock the admin settings inside the test
    // Actually, we can just spy on axios if we don't have settings, but let's test it against a dummy url if we insert it.
    // Since we don't want to insert data, let's just patch the settings fetch.
    const originalSelect = supabaseAdmin.from;
    supabaseAdmin.from = function(table) {
        if (table === 'tenant_notification_settings') {
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({
                            data: {
                                domain: 'cloudospire.in',
                                trigger_webhook_on_signup: true,
                                admin_webhook_url: 'https://httpbin.org/post'
                            }
                        })
                    })
                })
            }
        }
        return originalSelect.call(this, table);
    };

    try {
        const result = await notificationEngine.processSignupNotifications(domain, userData);
        console.log('Notification Engine Result:', result);
    } catch (e) {
        console.error('Error during test:', e);
    }
}

runTest();
