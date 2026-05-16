
const { supabaseAdmin } = require('../server/lib/supabaseClient');

async function fixProfile() {
    const email = 'kumar@gmail.com';
    console.log(`Checking profile for ${email}...`);

    const { data: user, error: userError } = await supabaseAdmin.auth.admin.listUsers();
    console.log('All Users in Auth:', user?.users?.map(u => u.email));
    const targetUser = user?.users?.find(u => u.email === email);

    if (!targetUser) {
        console.error('User not found in Auth.');
        return;
    }

    console.log(`Found Auth User: ${targetUser.id}`);

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', targetUser.id)
        .maybeSingle();

    if (profile) {
        console.log('Profile already exists:', profile);
    } else {
        console.log('Profile missing. Creating...');
        const { error: insertError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: targetUser.id,
                email: email,
                signup_domain: 'whatsappflow.in',
                role: 'owner',
                plan_name: 'Free Trial'
            });
        
        if (insertError) console.error('Failed to create profile:', insertError);
        else console.log('✅ Profile created successfully.');
    }
}

fixProfile();
