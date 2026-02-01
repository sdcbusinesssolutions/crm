
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSubs() {
    console.log('Checking User Subscriptions...');
    const { data: subs, error } = await supabase
        .from('user_subscriptions')
        .select('*');

    if (error) console.error(error);
    else {
        console.log(`Found ${subs.length} subscriptions.`);
        subs.forEach(s => {
            console.log(`Sub ID: ${s.id}, User: ${s.user_id}, Plan: ${s.plan_id}, Amount: ${s.amount}, Status: ${s.status}`);
        });
    }

    console.log('Checking Plans...');
    const { data: plans } = await supabase.from('plans').select('*');
    if (plans) {
        plans.forEach(p => {
            console.log(`Plan ID: ${p.id}, Name: ${p.name}, Pricing:`, JSON.stringify(p.pricing));
        });
    }
}

checkSubs();
