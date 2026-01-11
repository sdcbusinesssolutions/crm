
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreRelatedTasks() {
    console.log('--- RESTORE RELATED TASKS ---');

    // 1. Resolve Users
    const { data: { users } } = await supabase.auth.admin.listUsers();

    // Target: kd31967
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // Source: user1.compnet
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    // 2. Get U1's Leads
    // Tasks are linked to leads via 'lead_id'
    const { data: u1Leads } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', u1.id);

    console.log(`User 1 has ${u1Leads.length} leads.`);

    if (u1Leads.length === 0) {
        console.log('No leads found for U1. Cannot match tasks.');
        return;
    }

    const leadIds = u1Leads.map(l => l.id);

    // 3. Find Tasks owned by U3 that reference these leads
    // Note: We used to think 'contacts' and 'leads' were separate, but tasks link to leads.
    // If we only restored 'contacts' for some groups, but 'leads' table was empty or not fully synced, 
    // we might have missed some.
    // BUT, i ran restore_related_leads.js which populated leads.

    console.log('Finding tasks linked to these leads (owned by U3)...');

    const { data: tasks, error: tError } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', u3.id)
        .in('lead_id', leadIds); // Match tasks where lead_id is in our list

    if (tError) { console.error('Error searching tasks:', tError); return; }

    console.log(`Found ${tasks.length} orphaned tasks.`);

    if (tasks.length > 0) {
        const taskIds = tasks.map(t => t.id);

        const { error: moveError } = await supabase
            .from('tasks')
            .update({ user_id: u1.id })
            .in('id', taskIds);

        if (moveError) console.error('Error moving tasks:', moveError);
        else console.log('Tasks moved to User 1.');
    }

    console.log('--- TASKS RESTORE COMPLETE ---');
}

restoreRelatedTasks();
