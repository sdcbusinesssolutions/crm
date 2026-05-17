const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('❌ Error: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing in server/.env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function diagnostic() {
    console.log('🌐 Supabase Target URL:', supabaseUrl);
    console.log('🔍 Listing Auth Users...');

    try {
        const { data, error } = await supabase.auth.admin.listUsers();
        if (error) {
            console.error('❌ Failed to list users:', error.message);
            return;
        }

        const users = data?.users || [];
        console.log(`📊 Found ${users.length} user(s) in auth.users:\n`);
        
        users.forEach(u => {
            console.log(`👤 ID: ${u.id}`);
            console.log(`   Email: ${u.email}`);
            console.log(`   Role: ${u.role}`);
            console.log(`   Email Confirmed: ${!!u.email_confirmed_at}`);
            console.log(`   Last Sign In: ${u.last_sign_in_at || 'Never'}`);
            console.log(`   Created At: ${u.created_at}`);
            console.log('   ---------------------------------------------');
        });

        // Let's also check profiles table
        console.log('\n🔍 Fetching profiles table details...');
        const { data: profiles, error: profileErr } = await supabase
            .from('profiles')
            .select('*');

        if (profileErr) {
            console.warn('⚠️ Could not fetch profiles table:', profileErr.message);
        } else {
            console.log(`📊 Found ${profiles?.length || 0} profile record(s):\n`);
            profiles?.forEach(p => {
                console.log(`📄 Profile for User ID: ${p.id}`);
                console.log(`   Signup Domain: ${p.signup_domain}`);
                console.log(`   Role: ${p.role}`);
                console.log('   ---------------------------------------------');
            });
        }

        // Also check if they are in team/staff tables
        console.log('\n🔍 Fetching team_staff / staff table details...');
        const { data: staff, error: staffErr } = await supabase
            .from('staff')
            .select('*');
        if (staffErr) {
            const { data: teamStaff, error: teamStaffErr } = await supabase
                .from('team_staff')
                .select('*');
            if (teamStaffErr) {
                console.warn('⚠️ Could not fetch staff/team_staff table:', teamStaffErr.message);
            } else {
                console.log(`📊 Found ${teamStaff?.length || 0} team_staff record(s):\n`);
                teamStaff?.forEach(s => {
                    console.log(`🧑‍💼 Name: ${s.name}`);
                    console.log(`   Email: ${s.email}`);
                    console.log(`   Role: ${s.role}`);
                    console.log('   ---------------------------------------------');
                });
            }
        } else {
            console.log(`📊 Found ${staff?.length || 0} staff record(s):\n`);
            staff?.forEach(s => {
                console.log(`🧑‍💼 Name: ${s.name}`);
                console.log(`   Email: ${s.email}`);
                console.log(`   Role: ${s.role}`);
                console.log('   ---------------------------------------------');
            });
        }

    } catch (e) {
        console.error('❌ Exception during diagnostic:', e.message);
    }
}

diagnostic();
