const { supabaseAdmin } = require('./lib/supabaseClient');

async function testRR() {
    const userId = '1dd0acd9-090a-4c64-896e-4db51c775902'; // the user's ID
    const staffIds = ['6274c2ee-6da1-4ec9-891e-a651326303d8', 'some-other-id']; // put real IDs
    
    // Fetch last leads
    const { data: lastLeads } = await supabaseAdmin
        .from('leads')
        .select('assigned_staff_ids, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

    console.log("LAST LEADS:", JSON.stringify(lastLeads, null, 2));
    
    // Find last assigned
    let lastAssignedId = null;
    if (lastLeads) {
        for (const lead of lastLeads) {
            const ids = lead.assigned_staff_ids || [];
            console.log("CHECKING LEAD IDS:", ids, "AGAINST STAFF IDS:", staffIds);
            const match = ids.find(id => staffIds.includes(id));
            if (match) {
                lastAssignedId = match;
                break;
            }
        }
    }
    console.log("LAST ASSIGNED ID:", lastAssignedId);
}
testRR();
