
// Override Env Vars for Clickube
process.env.SUPABASE_URL = 'https://ssckorsnhjhzqxyukexm.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';
process.env.SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const { supabaseAdmin } = require('../lib/supabaseClient');

(async () => {
    try {
        console.log('\n========================================');
        console.log('   SERVICE ACCOUNT EMAIL FINDER');
        console.log('========================================\n');

        const { data: connections, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'google');

        if (error) {
            console.error('❌ DB Error:', error);
            process.exit(1);
        }

        const conn = connections.find(c => c.connection_name.includes('21Jan'));

        if (!conn) {
            console.error('❌ Connection "21Jan" not found');
            process.exit(1);
        }

        const creds = conn.credentials;

        if (creds.private_key && creds.client_email) {
            console.log('✅ Service Account Found!\n');
            console.log('📧 SERVICE ACCOUNT EMAIL:');
            console.log('   ' + creds.client_email);
            console.log('\n📋 INSTRUCTIONS:');
            console.log('   1. Open your Google Spreadsheet');
            console.log('   2. Click the "Share" button (top right)');
            console.log('   3. Add this email: ' + creds.client_email);
            console.log('   4. Give it "Editor" permissions');
            console.log('   5. Click "Send"');
            console.log('\n✅ After sharing, the "Load Sheets" button will work!\n');
        } else {
            console.log('⚠️  This is an OAuth connection, not a Service Account');
            console.log('   No email sharing needed for OAuth connections');
        }

    } catch (e) {
        console.error('❌ Fatal Error:', e.message);
    }
    process.exit(0);
})();
