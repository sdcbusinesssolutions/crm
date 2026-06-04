const { supabaseAdmin } = require('./lib/supabaseClient');

async function testSim() {
    const userId = '1dd0acd9-090a-4c64-896e-4db51c775902';
    const staffIds = [
        '550da64f-b6e9-4e76-805c-35d564ef2d97', // u1
        'd759d5dc-c27d-4767-9d7a-1fdbab51ed6b', // u2
        '2dd428b4-ef55-46f9-aa2b-58bbceb26a63'  // u3
    ]; 
    const contactPhone = '919373393645'; // User's test phone

    for(let i = 0; i < 3; i++) {
        // Round robin logic
        const { data: lastLeads } = await supabaseAdmin
            .from('leads')
            .select('assigned_staff_ids, created_at, phone')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);

        let lastAssignedId = null;
        if (lastLeads) {
            for (const lead of lastLeads) {
                const ids = lead.assigned_staff_ids || [];
                const match = ids.find(id => staffIds.includes(id));
                if (match) {
                    lastAssignedId = match;
                    break;
                }
            }
        }

        let assignedStaffId = null;
        if (!lastAssignedId) {
            assignedStaffId = staffIds[0];
        } else {
            const currentIndex = staffIds.indexOf(lastAssignedId);
            if (currentIndex === -1 || currentIndex === staffIds.length - 1) {
                assignedStaffId = staffIds[0];
            } else {
                assignedStaffId = staffIds[currentIndex + 1];
            }
        }

        console.log(`[SIM ${i}] Decided to assign to: ${assignedStaffId}`);

        // Update the lead
        const { error } = await supabaseAdmin
            .from('leads')
            .update({ assigned_staff_ids: [assignedStaffId] })
            .eq('user_id', userId)
            .eq('phone', contactPhone);
            
        // small delay
        await new Promise(r => setTimeout(r, 1000));
    }
}
testSim();
