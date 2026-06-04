const { getAuthenticatedSupabase } = require('./lib/supabaseClient');

async function test() {
    try {
        const { supabaseAdmin } = require('./lib/supabaseClient');
        const email = 'test_rls_' + Date.now() + '@example.com';
        const password = 'Password123!';
        
        console.log('Creating temp user...');
        const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (authErr) throw authErr;
        const userId = authData.user.id;
        
        console.log('Signing in...');
        const { supabase } = require('./lib/supabaseClient');
        const { data: sessionData, error: sessionErr } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (sessionErr) throw sessionErr;
        const token = sessionData.session.access_token;
        
        const req = {
            headers: { authorization: `Bearer ${token}` },
            user: { id: userId }
        };
        const client = getAuthenticatedSupabase(req);
        
        console.log('Inserting contact...');
        const { data: contactData, error: contactErr } = await client
            .from('contacts')
            .insert({
                user_id: userId,
                name: 'Test Contact',
                phone: '1234567890'
            })
            .select();
            
        if (contactErr) {
            console.log('Contact Insert Error:', contactErr);
            await supabaseAdmin.auth.admin.deleteUser(userId);
            return;
        }
        console.log('Contact Insert Result:', contactData);
        
        const contactId = contactData[0].id;
        
        console.log('Inserting follow_up with contact_id:', contactId);
        const { data, error } = await client
            .from('follow_ups')
            .insert({
                user_id: userId,
                contact_id: contactId,
                title: 'Test',
                description: 'Test',
                scheduled_at: new Date().toISOString(),
                priority: 'MEDIUM',
                type: 'TASK',
                status: 'PENDING'
            })
            .select();
            
        console.log('FollowUp Result:', data);
        if (error) console.log('FollowUp Error:', error);
        
        // Cleanup
        await supabaseAdmin.auth.admin.deleteUser(userId);
    } catch (e) {
        console.error('Exception:', e);
    }
}
test();
