const { supabaseAdmin } = require('../../../lib/supabaseClient');
const logger = require('../../../utils/logger');

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
            // 1st: Check conversation
            const { data: currentConv } = await supabaseAdmin
                .from('conversations')
                .select('assigned_to')
                .eq('user_id', userId)
                .eq('contact_phone', contactPhone)
                .limit(1)
                .maybeSingle();
            
            let existingStaffId = currentConv?.assigned_to;

            // 2nd: Fallback to lead
            if (!existingStaffId) {
                const { data: currentLeads } = await supabaseAdmin
                    .from('leads')
                    .select('assigned_staff_ids')
                    .eq('user_id', userId)
                    .eq('phone', contactPhone)
                    .limit(1)
                    .maybeSingle();
                
                if (currentLeads && currentLeads.assigned_staff_ids && currentLeads.assigned_staff_ids.length > 0) {
                    existingStaffId = currentLeads.assigned_staff_ids[0];
                }
            }
            
            if (existingStaffId) {
                // If the lead's current agent is in our selected pool, KEEP THEM!
                if (staffIds.includes(existingStaffId)) {
                    let existingStaffName = 'Agent';
                    const { data: staffData } = await supabaseAdmin.from('team_staff').select('name').eq('id', existingStaffId).single();
                    if (staffData) {
                        existingStaffName = staffData.name;
                    }

                    console.log(`[AssignLead] Lead ${contactPhone} already assigned to ${existingStaffId} (${existingStaffName}). Keeping assignment.`);
                    logger.logStaffAssignment('flow_assignment', { message: `Flow: ${context?.flowId || 'Unknown'} - Kept existing assignment for phone ${contactPhone} to staff ${existingStaffId} (${existingStaffName})` });

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

            if (assignmentMethod === 'specific_user') {
                assignedStaffId = staffIds[0];
            } else if (assignmentMethod === 'round_robin') {
                // Fetch the last assigned lead for this user to determine the next in the round-robin pool
                const { data: lastLeads } = await supabaseAdmin
                    .from('leads')
                    .select('assigned_staff_ids')
                    .eq('user_id', userId)
                    .not('assigned_staff_ids', 'is', null)
                    .order('updated_at', { ascending: false })
                    .limit(20);

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
                // Get Staff Name
                const { data: staffData } = await supabaseAdmin.from('team_staff').select('name').eq('id', assignedStaffId).single();
                if (staffData) {
                    staffName = staffData.name;
                }

                console.log(`[AssignLead] Assigning lead ${contactPhone} to staff ${assignedStaffId} (${staffName})`);
                logger.logStaffAssignment('flow_assignment', { message: `Flow: ${context?.flowId || 'Unknown'} - Starting assignment process for phone ${contactPhone} to staff ${assignedStaffId} (${staffName})` });

                // 1. Update or Create Lead
                const { data: existingLeadData } = await supabaseAdmin
                    .from('leads')
                    .select('id, assigned_staff_ids')
                    .eq('user_id', userId)
                    .eq('phone', contactPhone)
                    .limit(1)
                    .maybeSingle();

                if (existingLeadData) {
                    let currentIds = existingLeadData.assigned_staff_ids || [];
                    if (!currentIds.includes(assignedStaffId)) {
                        const { error: leadError } = await supabaseAdmin
                            .from('leads')
                            .update({ 
                                assigned_staff_ids: [...currentIds, assignedStaffId],
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existingLeadData.id);
                        if (leadError) {
                            console.error(`[AssignLead] Error updating lead assigned_staff_ids:`, leadError);
                        } else {
                            console.log(`[AssignLead] Appended staff ${assignedStaffId} (${staffName}) to existing lead ${existingLeadData.id}`);
                            logger.logStaffAssignment('flow_assignment', { message: `Flow: ${context?.flowId || 'Unknown'} - Appended staff ${assignedStaffId} (${staffName}) to existing lead ${existingLeadData.id} for phone ${contactPhone}` });
                        }
                    } else {
                        console.log(`[AssignLead] Staff ${assignedStaffId} (${staffName}) is already assigned to lead ${existingLeadData.id}`);
                        logger.logStaffAssignment('flow_assignment', { message: `Flow: ${context?.flowId || 'Unknown'} - Staff ${assignedStaffId} (${staffName}) already assigned to lead ${existingLeadData.id} for phone ${contactPhone}` });
                    }
                } else {
                    const { data: newLead, error: leadError } = await supabaseAdmin.from('leads').insert({
                        user_id: userId,
                        phone: contactPhone,
                        name: 'Unknown Contact',
                        assigned_staff_ids: [assignedStaffId],
                        pipeline_id: null,
                        stage_id: null,
                        status: 'new'
                    }).select('id').single();
                    
                    if (leadError) {
                        console.error(`[AssignLead] Error creating lead for assignment:`, leadError);
                    } else {
                        console.log(`[AssignLead] Created new lead ${newLead?.id} and assigned staff ${assignedStaffId} (${staffName})`);
                        logger.logStaffAssignment('flow_assignment', { message: `Flow: ${context?.flowId || 'Unknown'} - Created new lead ${newLead?.id} and assigned staff ${assignedStaffId} (${staffName}) for phone ${contactPhone}` });
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
                } else {
                    console.log(`[AssignLead] Updated conversation assigned_to with ${assignedStaffId}`);
                }
            }

            // Return the output so the next node can use it
            return {
                status: 'success',
                assignedStaffId: assignedStaffId,
                assignedStaffName: staffName,
                message: `Assigned to ${staffName}`
            };

        } catch (err) {
            console.error(`[AssignLead] Error executing node:`, err);
            return { status: 'error', message: err.message };
        }
    }
}

module.exports = new AssignLeadExecutor();
