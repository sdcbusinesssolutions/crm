
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function identifyOldOwner() {
    console.log('--- IDENTIFY OLD OWNER ---');
    const oldId = '098b55db-17b6-4427-ba88-1f6112abae0e';

    // List all users
    const { data: { users }, error } = await supabase.auth.admin.listUsers();

    if (error) { console.error(error); return; }

    const victim = users.find(u => u.id === oldId);

    if (victim) {
        console.log(`The ID ${oldId} belongs to: ${victim.email}`);
    } else {
        console.log(`The ID ${oldId} was NOT found in auth.users. It might be a deleted user or a random UUID.`);
    }

    // List all emails for context
    // console.log('All available users:');
    // users.forEach(u => console.log(`- ${u.email} [${u.id}]`));
}

identifyOldOwner();
