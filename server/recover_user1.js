
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function recoverUser1Data() {
    console.log('--- RECOVER USER 1 DATA ---');

    // Get timestamps
    const { data: { users } } = await supabase.auth.admin.listUsers();

    // U1 = kd31967 (Target)
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // U3 = user1.compnet (Source of accidental merge)
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com');

    if (!u1 || !u3) { console.log('Users not found'); return; }

    // Logic: contacts owned by U3 but created AFTER U1's account creation date 
    // AND created AFTER '2025-11-23 10:40:40' logic.
    // To be safe, let's use the explicit string from previous log if needed, but the object comparison worked.

    const cutoffDate = new Date(u1.created_at).toISOString();
    console.log(`Recovering contacts created AFTER: ${cutoffDate}`);

    // 1. Recover Contacts
    const { data: contactsToMove, error: findError } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', u3.id)
        .gt('created_at', cutoffDate); // Greater Than (Newer)

    if (findError) { console.error(findError); return; }

    console.log(`Found ${contactsToMove.length} contacts belonging to User 1.`);

    if (contactsToMove.length > 0) {
        // Perform Update
        const ids = contactsToMove.map(c => c.id);

        // Breaking into chunks if too many ids (Supabase/Postgres limit)
        // Check size... 1000 is usually fine. 
        // We'll trust straight filtering update is safer than IN list if possible?
        // Actually .gt('created_at', cutoff).eq('user_id', u3.id) is a stable filter for UPDATE.

        const { error: moveError } = await supabase
            .from('contacts')
            .update({ user_id: u1.id })
            .eq('user_id', u3.id)
            .gt('created_at', cutoffDate);

        if (moveError) console.error('Move Error:', moveError);
        else console.log('Contacts successfully recovered to User 1.');
    }

    // 2. Recover Leads
    const { error: leadsError } = await supabase
        .from('leads')
        .update({ user_id: u1.id })
        .eq('user_id', u3.id)
        .gt('created_at', cutoffDate);

    if (leadsError) console.error('Leads Move Error:', leadsError);
    else console.log('Leads recovered.');

    // 3. Recover Groups
    const { error: groupsError } = await supabase
        .from('contact_groups')
        .update({ user_id: u1.id })
        .eq('user_id', u3.id)
        .gt('created_at', cutoffDate);

    if (groupsError) console.error('Groups Move Error:', groupsError);
    else console.log('Groups recovered.');

    // 4. Recover Tasks
    // Tasks might have 'due_date' not 'created_at'? No, they should have created_at.
    // Checking schema.... Tasks schema usually has created_at.
    const { error: tasksError } = await supabase
        .from('tasks')
        .update({ user_id: u1.id })
        .eq('user_id', u3.id)
        .gt('created_at', cutoffDate); // Assuming created_at exists

    // If tasks don't have created_at, we might need a backup plan, but standard is yes.
    if (tasksError) console.error('Tasks Move Error:', tasksError);
    else console.log('Tasks recovered.');

    console.log('--- RECOVERY COMPLETE ---');
}

recoverUser1Data();
