
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function revertOwnership() {
    console.log('--- REVERT OWNERSHIP ---');

    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    // U1 = kd31967 (Original accidental owner)
    const u1 = users.find(u => u.email === 'kd31967@gmail.com');
    // U2 = onlinemarketing (Likely real owner)
    const u2 = users.find(u => u.email === 'onlinemarketing1007@gmail.com');

    if (!u1 || !u2) {
        console.error('Users not found');
        return;
    }

    const currentOwnerId = u2.id; // Currently U2 has them
    const targetOwnerId = u1.id;  // Move back to U1

    console.log(`Moving data BACK FROM ${u2.email} TO ${u1.email}`);

    // 1. Contacts
    const { count: countBefore } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('user_id', currentOwnerId);
    console.log(`Contacts to move: ${countBefore}`);

    if (countBefore > 0) {
        const { error: err1 } = await supabase
            .from('contacts')
            .update({ user_id: targetOwnerId })
            .eq('user_id', currentOwnerId);

        if (err1) console.error('Error moving contacts:', err1);
        else console.log('Contacts moved back.');
    }

    // 2. Leads
    const { error: err2 } = await supabase.from('leads').update({ user_id: targetOwnerId }).eq('user_id', currentOwnerId);
    if (err2) console.error('Error moving leads:', err2);
    else console.log('Leads moved back.');

    // 3. Groups
    const { error: err3 } = await supabase.from('contact_groups').update({ user_id: targetOwnerId }).eq('user_id', currentOwnerId);
    if (err3) console.error('Error moving groups:', err3);
    else console.log('Groups moved back.');

    // 4. Tasks
    const { error: err4 } = await supabase.from('tasks').update({ user_id: targetOwnerId }).eq('user_id', currentOwnerId);
    if (err4) console.error('Error moving tasks:', err4);
    else console.log('Tasks moved back.');

    console.log('--- REVERT COMPLETE ---');
}

revertOwnership();
