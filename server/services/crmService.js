const { supabase, supabaseAdmin } = require('../lib/supabaseClient');

class CrmService {
    async getPipelines(userId) {
        const rpcClient = supabaseAdmin || supabase;

        const { data: pipelines, error } = await rpcClient
            .from('pipelines')
            .select('id, name')
            .eq('user_id', userId)
            // .eq('is_active', true) // Assuming active only
            .order('created_at', { ascending: true });

        if (error) throw error;
        return pipelines;
    }

    async getStages(pipelineId) {
        const rpcClient = supabaseAdmin || supabase;

        const { data: stages, error } = await rpcClient
            .from('pipeline_stages')
            .select('id, name, display_order')
            .eq('pipeline_id', pipelineId)
            // .eq('is_active', true)
            .order('display_order', { ascending: true });

        if (error) throw error;
        return stages;
    }
}

module.exports = new CrmService();
