
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env');
    // console.log('Parsed Env:', process.env);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function syncPlans() {
    console.log('Starting Plan Sync...');

    // 1. Fetch all active subscriptions
    const { data: subs, error: subError } = await supabase
        .from('user_subscriptions')
        .select(`
            id,
            user_id,
            plan_id,
            end_date,
            status,
            plans ( name )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

    if (subError) {
        console.error('Error fetching subscriptions:', subError);
        return;
    }

    console.log(`Found ${subs.length} active subscriptions.`);

    // 2. Map latest subscription per user
    const userSubs = {};
    subs.forEach(sub => {
        if (!userSubs[sub.user_id]) {
            userSubs[sub.user_id] = sub;
        }
    });

    console.log(`Unique users with active plans: ${Object.keys(userSubs).length}`);

    // 3. Update Profiles
    for (const userId of Object.keys(userSubs)) {
        const sub = userSubs[userId];
        const planName = sub.plans?.name || 'Unknown Plan';
        const expiry = sub.end_date;

        console.log(`Updating User ${userId}: Plan=${planName}, Expires=${expiry}`);

        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                plan_name: planName,
                plan_status: 'active',
                plan_expires_at: expiry
            })
            .eq('id', userId);

        if (updateError) {
            console.error(`Failed to update user ${userId}:`, updateError);
        } else {
            console.log(`✅ Success`);
        }
    }

    console.log('Sync Complete.');
}

syncPlans();
