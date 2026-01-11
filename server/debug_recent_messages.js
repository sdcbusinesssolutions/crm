
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugMessages() {
    console.log('--- Debugging Message Data ---');

    // 1. Find User
    // Try to find a user from recent messages or tasks to ensure we get an active one
    let userId;
    const { data: m } = await supabase.from('messages').select('conversations(user_id)').limit(1);
    if (m && m.length && m[0].conversations) {
        userId = m[0].conversations.user_id;
        console.log('Inferred User ID from messages:', userId);
    } else {
        const { data: t } = await supabase.from('tasks').select('user_id').limit(1);
        if (t && t.length) {
            userId = t[0].user_id;
            console.log('Inferred User ID from tasks:', userId);
        } else {
            console.log('Could not infer user ID. Aborting.');
            return;
        }
    }

    // 2. Check Timezone/Date
    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    console.log('Current Server Time:', now.toISOString());
    console.log('7 Days Ago Threshold:', sevenDaysAgo.toISOString());

    // 3. Fetch Most Recent Messages (Any Direction)
    const { data: recentMsgs, error } = await supabase
        .from('messages')
        .select('id, created_at, status, direction, conversations!inner(user_id)')
        .eq('conversations.user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching messages:', error);
    } else {
        console.log(`\nFound ${recentMsgs.length} recent messages.`);
        recentMsgs.forEach(msg => {
            const date = new Date(msg.created_at);
            const isVisible = date >= sevenDaysAgo;
            console.log(`[${msg.created_at}] Status: ${msg.status}, Direction: ${msg.direction}, Visible in Chart (> 7d ago)? ${isVisible ? 'YES' : 'NO'}`);
        });
    }

    // 4. Mimic Dashboard Query Exactly
    const { data: chartData, error: chartError } = await supabase
        .from('messages')
        .select('created_at, status, direction, conversations!inner(user_id)')
        .eq('conversations.user_id', userId)
        .eq('direction', 'out')
        .gte('created_at', sevenDaysAgo.toISOString());

    if (chartError) console.error('Dashboard Query Error:', chartError);
    else console.log(`\nDashboard Query returned: ${chartData.length} rows.`);

}

debugMessages().catch(console.error);
