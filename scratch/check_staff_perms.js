const path = require('path');
const { supabaseAdmin } = require(path.join(__dirname, '../server/lib/supabaseClient'));

async function checkStaffPerms() {
    try {
        console.log('Querying team_staff for user3...');
        const { data: staffList, error: staffError } = await supabaseAdmin
            .from('team_staff')
            .select('*')
            .or('email.ilike.%user3%');
        
        if (staffError) {
            console.error('Error fetching staff:', staffError);
            return;
        }

        console.log('Staff records matching "user3":', JSON.stringify(staffList, null, 2));

        if (!staffList || staffList.length === 0) {
            console.log('No staff member found matching "user3"');
            return;
        }

        for (const staff of staffList) {
            console.log(`\nFetching permissions for staff ID: ${staff.id} (${staff.name} / ${staff.email})...`);
            const { data: perms, error: permError } = await supabaseAdmin
                .from('team_staff_permissions')
                .select('*')
                .eq('staff_id', staff.id);

            if (permError) {
                console.error(`Error fetching permissions for ${staff.id}:`, permError);
                continue;
            }

            console.log(`Permissions for ${staff.email}:`, JSON.stringify(perms, null, 2));
        }
    } catch (err) {
        console.error('Catch error:', err);
    }
}

checkStaffPerms();
