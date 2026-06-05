const { supabaseAdmin } = require('../../../lib/supabaseClient');

class AssignLeadExecutor {
    async execute(session, node, context) {
        try {
            const data = node.data;
            const assignmentMethod = data.assignmentMethod || 'round_robin';
            const staffIds = data.staffIds || [];

            const contactPhone = session.contact_phone;
            const userId = session.user_id;

            if (staffIds.length === 0) {
                console.log(`[AssignLead] No staff members configured for assignment.`);
                return { status: 'skipped', reason: 'no_staff_configured' };
            }

            let assignedStaffId = null;

            // Check if the lead is already assigned to someone in the current pool
            const { data: currentLeads } = await supabaseAdmin
                .from('leads')
                .select('assigned_staff_ids')
                .eq('user_id', userId)
                .eq('phone', contactPhone)
                .limit(1);
            
            if (currentLeads && currentLeads.length > 0) {
                const currentLead = currentLeads[0];
                if (currentLead.assigned_staff_ids && currentLead.assigned_staff_ids.length > 0) {
                    const existingStaffId = currentLead.assigned_staff_ids[0];
                    // If the lead's current agent is in our selected pool, KEEP THEM!
                    if (staffIds.includes(existingStaffId)) {
                        console.log(`[AssignLead] Lead ${contactPhone} already assigned to ${existingStaffId}. Keeping assignment.`);
                        
                        let existingStaffName = 'Agent';
                        const { data: staffData } = await supabaseAdmin.from('team_staff').select('name').eq('id', existingStaffId).single();
                        if (staffData) {
                            existingStaffName = staffData.name;
                        }

                        // Ensure conversation routes to them, but don't touch lead updated_at so Round Robin isn't affected
                        await supabaseAdmin
                            .from('conversations')
                            .update({ assigned_to: existingStaffId })
                            .eq('user_id', userId)
                            .eq('contact_phone', contactPhone);

                        return {
                            status: 'success',
                            assignedStaffId: existingStaffId,
                            assignedStaffName: existingStaffName
                        };
                    }
                }
            }

            if (assignmentMethod === 'specific_user') {
                assignedStaffId = staffIds[0];
            } else if (assignmentMethod === 'round_robin') {
                // Fetch the last assigned lead for this user to determine the next in the round-robin pool
                const { data: lastLeads } = await supabaseAdmin
                    .from('leads')
                    .select('assigned_staff_ids')
                    .eq('user_id', userId)
                    .order('updated_at', { ascending: false })
                    .limit(5);

                // Find the last staff assigned from the list
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

            let staffName = 'Agent';

            if (assignedStaffId) {
                console.log(`[AssignLead] Assigning lead ${contactPhone} to staff ${assignedStaffId}`);
                
                // Get Staff Name
                const { data: staffData } = await supabaseAdmin.from('team_staff').select('name').eq('id', assignedStaffId).single();
                if (staffData) {
                    staffName = staffData.name;
                }

                // 1. Update the lead's assigned_staff_ids field (array format)
                const { data: existingLeads } = await supabaseAdmin
                    .from('leads')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('phone', contactPhone)
                    .limit(1);

                if (existingLeads && existingLeads.length > 0) {
                    const { error: leadError } = await supabaseAdmin
                        .from('leads')
                        .update({ 
                            assigned_staff_ids: [assignedStaffId],
                            updated_at: new Date().toISOString()
                        })
                        .eq('user_id', userId)
                        .eq('phone', contactPhone);
                    
                    if (leadError) {
                        console.error(`[AssignLead] Error updating lead assigned_staff_ids:`, leadError);
                    }
                } else {
                    const { error: leadError } = await supabaseAdmin
                        .from('leads')
                        .insert([{
                            user_id: userId,
                            phone: contactPhone,
                            name: session.contact_name || contactPhone,
                            assigned_staff_ids: [assignedStaffId],
                            status: 'active',
                            source: 'whatsapp_flow',
                            type: 'Lead',
                            custom_data: { assigned_staff_ids: [assignedStaffId] },
                            created_at: new Date().toISOString(),
                            updated_at: new Date().toISOString()
                        }]);

                    if (leadError) {
                        console.error(`[AssignLead] Error creating lead assigned_staff_ids:`, leadError);
                    }
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

            // Return the output so the next node can use it
            return {
                status: 'success',
                assignedStaffId: assignedStaffId,
                assignedStaffName: staffName
            };

        } catch (err) {
            console.error(`[AssignLead] Error executing node:`, err);
            return { status: 'error', message: err.message };
        }
    }
}

module.exports = new AssignLeadExecutor();
