const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const TARGET_USER_ID = '35d4fe7d-753d-43da-85fb-a32b6f66133e';

async function runQueries() {
    console.log(`--- Running Queries for User: ${TARGET_USER_ID} ---`);

    // 1. Total Contacts Count
    console.log('\n--- 1. TOTAL CONTACTS ---');
    const { count: totalContacts, error: countError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', TARGET_USER_ID);

    if (countError) {
        console.error('Error counting contacts:', countError);
    } else {
        console.log(`Total Contacts: ${totalContacts}`);
    }

    // 2. Group-wise Count (Manual Aggregation)
    console.log('\n--- 2. GROUP-WISE COUNT ---');

    // A. Fetch Groups
    const { data: groups, error: gError } = await supabase
        .from('contact_groups')
        .select('id, name')
        .eq('user_id', TARGET_USER_ID);

    if (gError) {
        console.error('Error fetching groups:', gError);
        return;
    }

    if (!groups || groups.length === 0) {
        console.log("No groups found.");
        return;
    }

    console.log(`Found ${groups.length} groups.`);
    const groupIds = groups.map(g => g.id);
    const groupNameMap = {};
    groups.forEach(g => { groupNameMap[g.id] = g.name; });

    // B. Fetch Members for these groups
    // If getting all members is too heavy, we might need a different strategy, but for a script check it's likely fine unless 10k+ rows.
    // NOTE: 'contact_group_members' doesn't have user_id usually, just group_id and contact_id.
    const { data: members, error: mError } = await supabase
        .from('contact_group_members')
        .select('group_id')
        .in('group_id', groupIds);

    if (mError) {
        console.error('Error fetching group members:', mError);
        // Try alternate table name if this fails
        console.log('Trying "group_members" table...');
        const { data: members2, error: mError2 } = await supabase
            .from('group_members')
            .select('group_id')
            .in('group_id', groupIds);

        if (mError2) {
            console.error('Error fetching group_members:', mError2);
        } else {
            countAndLog(members2, groups);
        }
    } else {
        countAndLog(members, groups);
    }
}

function countAndLog(members, groups) {
    const counts = {};
    // Initialize
    groups.forEach(g => counts[g.id] = 0);

    // Count
    if (members) {
        members.forEach(m => {
            if (counts[m.group_id] !== undefined) {
                counts[m.group_id]++;
            }
        });
    }

    // Output
    console.log('--- Results ---');
    groups.forEach(g => {
        console.log(`Group: "${g.name}" : ${counts[g.id]} contacts`);
    });
}

runQueries();
