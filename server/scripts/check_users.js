const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function checkUsers() {
    const userIds = [
        '24893f5d-5d87-4314-8232-1cec9afed1f5',
        '38edee2f-04c5-4f4c-8ca1-baed6ed84711'
    ];

    console.log('Checking emails for duplicate config users...');

    // Check auth.users (Need Admin Privileges - usually hidden, but maybe we can query public profiles or similar)
    // Actually we can't query auth.users directly via JS client usually unless service role key allows it.
    // Let's try listing from a public table if exists, or use RPC if available.
    // Or just check 'users' table if you have a public profile table.

    // Assuming 'users' or 'profiles' table exists? 
    // Let's try 'auth.users' directly with Service Role Key (it usually works).

    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (users && users.users) {
        const found = users.users.filter(u => userIds.includes(u.id));
        found.forEach(u => {
            console.log(`User ID: ${u.id}`);
            console.log(`Email: ${u.email}`);
            console.log(`Created: ${u.created_at}`);
            console.log('-------------------------');
        });
    } else {
        console.log('Could not list users via Admin API. checking public tables...');
    }
}

checkUsers();
