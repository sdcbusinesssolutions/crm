const { supabaseAdmin } = require('../../../lib/supabaseClient');

/**
 * Assigns a lead to a specific user or via round robin.
 * @param {Object} node 
 * @param {Object} session 
 * @param {Object} engine 
 */
module.exports = async (node, session, engine) => {
    try {
        const data = node.data;
        const assignmentMethod = data.assignmentMethod || 'round_robin';
        const staffIds = data.staffIds || [];

        const contactPhone = session.contact_phone;
        const userId = session.user_id;

        if (staffIds.length === 0) {
            console.log(`[AssignLead] No staff members configured for assignment.`);
            return;
        }

        let assignedStaffId = null;

        if (assignmentMethod === 'specific_user') {
            assignedStaffId = staffIds[0];
        } else if (assignmentMethod === 'round_robin') {
            // Fetch the last assigned lead for this user to determine the next in the round-robin pool
            const { data: lastLeads } = await supabaseAdmin
                .from('leads')
                .select('assigned_to')
                .eq('user_id', userId)
                .in('assigned_to', staffIds)
                .order('created_at', { ascending: false })
                .limit(1);

            let lastAssignedId = null;
            if (lastLeads && lastLeads.length > 0) {
                lastAssignedId = lastLeads[0].assigned_to;
            }

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
        } else if (assignmentMethod === 'percentage') {
            const staffPercentages = data.staffPercentages || {};
            const validStaff = staffIds.filter(id => staffPercentages[id] > 0);
            
            if (validStaff.length === 0) {
                assignedStaffId = staffIds[0];
            } else {
                const totalWeight = validStaff.reduce((sum, id) => sum + staffPercentages[id], 0);
                let randomVal = Math.random() * totalWeight;
                
                for (const id of validStaff) {
                    randomVal -= staffPercentages[id];
                    if (randomVal <= 0) {
                        assignedStaffId = id;
                        break;
                    }
                }
                
                if (!assignedStaffId) {
                    assignedStaffId = validStaff[validStaff.length - 1];
                }
            }
        }

        if (assignedStaffId) {
            console.log(`[AssignLead] Assigning lead ${contactPhone} to staff ${assignedStaffId}`);
            
            // 1. Update the lead's assigned_to field
            const { error: leadError } = await supabaseAdmin
                .from('leads')
                .update({ assigned_to: assignedStaffId })
                .eq('user_id', userId)
                .eq('phone', contactPhone);
            
            if (leadError) {
                console.error(`[AssignLead] Error updating lead assigned_to:`, leadError);
            }
            
            // 2. Update the conversation assigned_to field so it routes in the inbox
            const { error: convError } = await supabaseAdmin
                .from('conversations')
                .update({ assigned_to: assignedStaffId })
                .eq('user_id', userId)
                .eq('contact_phone', contactPhone);
                
            if (convError) {
                console.error(`[AssignLead] Error updating conversation assigned_to:`, convError);
            }
        }

    } catch (err) {
        console.error(`[AssignLead] Error executing node:`, err);
    }
};
