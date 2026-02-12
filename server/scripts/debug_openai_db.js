const { supabaseAdmin } = require('../lib/supabaseClient');

async function testDB() {
    console.log('Testing Supabase Connection...');
    console.log('Current Directory:', process.cwd());

    if (!supabaseAdmin) {
        console.error('CRITICAL: supabaseAdmin is null! Check .env loading and SUPABASE_SERVICE_KEY.');
        return;
    }

    try {
        console.log('Fetching user_integrations...');
        const { data, error } = await supabaseAdmin.from('user_integrations').select('*');
        if (error) {
            console.error('Fetch Error - DB Connection Failed or Table Missing:', error);
            return;
        }
        console.log(`Connection Successful! Found ${data.length} integrations.`);

        if (data.length > 0) {
            console.log('First record snippet:', {
                id: data[0].id,
                provider: data[0].provider,
                name: data[0].connection_name
            });

            // Test Write
            const validUserId = data[0].user_id;
            console.log(`\nAttempting Test Insert for user_id: ${validUserId}...`);

            const insertPayload = {
                user_id: validUserId,
                provider: 'openai_debug_test',
                connection_name: 'Debug Key ' + Date.now(),
                credentials: { apiKey: 'sk-test-debug' },
                metadata: { type: 'debug' }
            };

            const { data: inserted, error: insertErr } = await supabaseAdmin
                .from('user_integrations')
                .insert(insertPayload)
                .select()
                .single();

            if (insertErr) {
                console.error('Insert Failed:', insertErr);
                if (insertErr.code === '23505') console.error('  -> Unique Constraint Violation (Expected if run rapidly, but mostly implies DB constraint works)');
                if (insertErr.code === '42501') console.error('  -> Permission Denied (Review RLS or Service Key)');
            } else {
                console.log('Insert Success! Record ID:', inserted.id);

                // Cleanup
                const { error: delErr } = await supabaseAdmin.from('user_integrations').delete().eq('id', inserted.id);
                if (delErr) console.error('Cleanup Failed:', delErr);
                else console.log('Cleanup Success. DB is Write-Ready.');
            }

        } else {
            console.log('No existing records found. Skipping insert test (need valid user_id).');
            console.log('NOTE: If you expected records, verify your DB content.');
        }

    } catch (e) {
        console.error('Unexpected Script Error:', e);
    }
}

testDB();
