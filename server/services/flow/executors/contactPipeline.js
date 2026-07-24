const { supabase, supabaseAdmin } = require('../../../lib/supabaseClient');
const { resolve } = require('../context');

const execute = async (session, node, context) => {
    try {
        const { pipelineId, stageId, name, email, customFields } = node.data;
        const phone = session.contact_phone;
        const userId = session.user_id;

        // Resolve inputs (support variables for pipelineId/stageId)
        const resolvedPipelineId = resolve(pipelineId, context);
        const resolvedStageId = resolve(stageId, context);
        const resolvedName = resolve(name, context);
        const resolvedEmail = resolve(email, context);

        if (!resolvedPipelineId || !resolvedStageId) {
            console.error('[ContactPipelineExecutor] Missing pipelineId or stageId');
            return { success: false, error: 'Configuration missing' };
        }

        console.log(`[ContactPipelineExecutor] Processing Lead for User ${userId}, Phone ${phone}. Pipeline: ${resolvedPipelineId}, Stage: ${resolvedStageId}`);

        const rpcClient = supabaseAdmin || supabase;

        // 1. Fetch Pipeline and Stage Names for Output Variable
        let pipelineName = 'Unknown';
        let stageName = 'Unknown';

        try {
            const { data: pData } = await rpcClient
                .from('pipelines')
                .select('name')
                .eq('id', resolvedPipelineId)
                .single();
            if (pData) pipelineName = pData.name;

            const { data: sData } = await rpcClient
                .from('pipeline_stages')
                .select('name')
                .eq('id', resolvedStageId)
                .single();
            if (sData) stageName = sData.name;
        } catch (ignored) {
            console.warn('[ContactPipelineExecutor] Could not fetch names for logging', ignored.message);
        }

        const { data: existingLeads, error: fetchError } = await rpcClient
            .from('leads')
            .select('*')
            .eq('user_id', userId)
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError) throw fetchError;

        let resultLead;

        if (existingLeads && existingLeads.length > 0) {
            // Update Existing Lead
            const leadId = existingLeads[0].id;
            const updates = {
                pipeline_id: resolvedPipelineId,
                stage_id: resolvedStageId,
                updated_at: new Date().toISOString()
            };

            if (resolvedName) updates.name = resolvedName;
            if (resolvedEmail) updates.email = resolvedEmail;

            // Process Custom Fields
            if (customFields && Array.isArray(customFields)) {
                customFields.forEach(field => {
                    const key = field.key?.trim();
                    if (key) {
                        const val = resolve(field.value, context);
                        // Add to updates only if not empty (or should we allow clearing?)
                        // User request: "only update the filed when using" - implies merge
                        // We will allow empty strings to clear if user explicitly passed empty
                        updates[key] = val;
                    }
                });
            }

            const { data: updated, error: updateError } = await rpcClient
                .from('leads')
                .update(updates)
                .eq('id', leadId)
                .select()
                .single();

            if (updateError) throw updateError;
            resultLead = updated;
            console.log(`[ContactPipelineExecutor] Moved existing lead ${leadId} to stage ${stageName}`);

        } else {
            // Create New Lead
            const newLead = {
                user_id: userId,
                phone: phone,
                pipeline_id: resolvedPipelineId,
                stage_id: resolvedStageId,
                name: resolvedName || session.variables.trigger?.name || phone, // Fallback
                email: resolvedEmail || '',
            };

            // Process Custom Fields for New Lead
            if (customFields && Array.isArray(customFields)) {
                customFields.forEach(field => {
                    const key = field.key?.trim();
                    if (key) {
                        newLead[key] = resolve(field.value, context);
                    }
                });
            }

            // Continue with standard fields
            Object.assign(newLead, {
                source: 'flow_automation',
                status: 'active',
                type: 'Lead'
            });

            const { data: created, error: createError } = await rpcClient
                .from('leads')
                .insert([newLead])
                .select()
                .single();

            if (createError) throw createError;
            resultLead = created;
            console.log(`[ContactPipelineExecutor] Created new lead ${created.id} in stage ${stageName}`);
        }

        return {
            status: 'success',
            leadId: resultLead.id,
            pipelineId: resolvedPipelineId,
            pipelineName: pipelineName,
            stageId: resolvedStageId,
            stageName: stageName,
            timestamp: new Date().toISOString(),
            __triggerEvent: {
                type: 'pipeline_change',
                payload: {
                    pipelineId: resolvedPipelineId,
                    stageId: resolvedStageId,
                    pipelineName: pipelineName,
                    stageName: stageName,
                    leadId: resultLead.id,
                    'contact.name': resultLead.name || phone,
                    'contact.phone': phone,
                    'contact.email': resultLead.email || ''
                }
            }
        };

    } catch (error) {
        console.error('[ContactPipelineExecutor] Execution failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { execute };
