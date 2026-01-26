
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const GmailService = require('../services/GmailService');
const { supabaseAdmin } = require('../lib/supabaseClient');

(async () => {
    try {
        console.log('--- DEBUG VEDS GMAIL ---');

        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'gmail');

        if (error) { console.error('DB Error', error); return; }

        const targetEmail = 'veds19920707@gmail.com';
        // Relaxed search
        const conn = connections.find(c =>
            (c.connection_name && c.connection_name.includes('veds19920707')) ||
            (c.metadata && c.metadata.email === targetEmail)
        );

        if (!conn) {
            console.error(`Connection for ${targetEmail} NOT FOUND in DB.`);
            console.log('Available Connections:', connections.map(c => `${c.connection_name} (${c.metadata?.email})`));
            return;
        }

        console.log(`Found Connection: ${conn.connection_name} (ID: ${conn.id})`);
        console.log('Credentials Keys:', Object.keys(conn.credentials));
        console.log('Refesh Token Exists:', !!conn.credentials.refresh_token);
        console.log('Expiry:', conn.credentials.expiry_date ? new Date(conn.credentials.expiry_date).toISOString() : 'None');

        // Test Send
        console.log('Attempting to send email to kd31967@gmail.com...');

        try {
            const result = await GmailService.sendEmail(
                conn.user_id,
                conn.id,
                'kd31967@gmail.com',
                'Debug Script Test',
                'Body Test'
            );
            console.log('SUCCESS:', result);
        } catch (err) {
            console.error('FAILURE:', err.message);
            console.error('Stack:', err.stack);
            if (err.response) console.error('API Error:', JSON.stringify(err.response.data, null, 2));
        }

    } catch (e) {
        console.error('Fatal:', e);
    }
    process.exit(0);
})();
