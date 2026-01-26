
// Override Env Vars for Clickube (from domains.csv)
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Now require modules - they will pick up the new env vars
const GmailService = require('../services/GmailService');
const { supabaseAdmin } = require('../lib/supabaseClient');

(async () => {
    try {
        console.log('---------- GMAIL CONNECTIVITY TEST (Clickube) ----------');
        console.log('Supabase URL:', process.env.SUPABASE_URL);

        // 3. Find Credentials
        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'gmail');

        if (error) {
            console.error('DB Error:', error);
            process.exit(1);
        }

        console.log(`Found ${connections.length} Gmail connections.`);

        for (const conn of connections) {
            console.log(`\n---------------------------------------------------`);
            console.log(`Testing Connection: ${conn.connection_name}`);
            console.log(`ID: ${conn.id}`);
            console.log(`User ID: ${conn.user_id}`);

            const expiryDate = conn.credentials.expiry_date ? new Date(conn.credentials.expiry_date) : null;
            const now = new Date();

            console.log(`Current Time: ${now.toISOString()}`);
            console.log(`Token Expiry: ${expiryDate ? expiryDate.toISOString() : 'Unknown'} (${conn.credentials.expiry_date})`);
            console.log(`Has Refresh Token: ${!!conn.credentials.refresh_token ? 'YES' : 'NO'}`);

            if (expiryDate && expiryDate < now) {
                console.log('⚠️ TOKEN IS EXPIRED. Expecting refresh...');
            } else {
                console.log('✅ Token is valid.');
            }

            // Attempt Send
            const to = conn.metadata?.email || 'admin@clickube.com'; // Try sending to self
            console.log(`Attempts sending to: ${to}`);

            try {
                const result = await GmailService.sendEmail(conn.user_id, conn.id, to, 'Debug Test: Token Refresh', '<p>If you see this, token refresh is working!</p>');
                console.log('✅ SEND SUCCESS:', result);
            } catch (err) {
                console.error('❌ SEND FAILED:', err.message);
                if (err.response) {
                    console.error('Google API Error:', JSON.stringify(err.response.data, null, 2));
                }
            }
        }

        console.log('\n---------------------------------------------------');
        console.log('Test Complete.');

    } catch (e) {
        console.error('Fatal Script Error:', e);
    }
    process.exit(0);
})();
