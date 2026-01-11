import { supabase } from '../lib/supabase';

// Helper to get auth headers
const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

const api = {
    get: async (url: string) => {
        const headers = await getHeaders();
        const res = await fetch(`/api${url}`, { headers });
        if (!res.ok) throw new Error(`GET ${url} failed: ${res.statusText}`);
        return await res.json();
    },
    post: async (url: string, body: any) => {
        const headers = await getHeaders();
        const res = await fetch(`/api${url}`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`POST ${url} failed: ${res.statusText}`);
        return await res.json();
    },
    put: async (url: string, body: any) => {
        const headers = await getHeaders();
        const res = await fetch(`/api${url}`, { method: 'PUT', headers, body: JSON.stringify(body) });
        if (!res.ok) throw new Error(`PUT ${url} failed: ${res.statusText}`);
        return await res.json();
    },
    delete: async (url: string) => {
        const headers = await getHeaders();
        const res = await fetch(`/api${url}`, { method: 'DELETE', headers });
        if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.statusText}`);
        return await res.json();
    }
};

export interface Pipeline {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    color: string;
    is_active: boolean;
    created_at: string;
}

export interface PipelineStage {
    id: string;
    user_id: string;
    pipeline_id: string;
    name: string;
    description?: string;
    color: string;
    display_order: number;
    is_active: boolean;
    created_at: string;
}

export interface CreatePipelineRequest {
    name: string;
    description?: string;
    color?: string;
    stages?: Array<{
        name: string;
        description?: string;
        color?: string;
        display_order?: number;
    }>;
}

export const pipelineService = {
    // Get all pipelines
    getPipelines: async (): Promise<Pipeline[]> => {
        try {
            return await api.get('/pipelines');
        } catch (e) {
            console.error('Failed to load pipelines', e);
            return [];
        }
    },

    // Get single pipeline
    getPipeline: async (id: string): Promise<Pipeline | null> => {
        try {
            return await api.get(`/pipelines/${id}`);
        } catch (e) {
            console.error('Failed to load pipeline', e);
            return null;
        }
    },

    // Get pipeline stages
    getPipelineStages: async (pipelineId: string): Promise<PipelineStage[]> => {
        try {
            return await api.get(`/pipelines/${pipelineId}/stages`);
        } catch (e) {
            console.error('Failed to load stages', e);
            return [];
        }
    },

    // Create pipeline
    createPipeline: async (pipeline: CreatePipelineRequest): Promise<Pipeline | null> => {
        return api.post('/pipelines', pipeline);
    },

    // Update pipeline
    updatePipeline: async (id: string, updates: Partial<Pipeline>): Promise<Pipeline | null> => {
        return api.put(`/pipelines/${id}`, updates);
    },

    // Delete pipeline
    deletePipeline: async (id: string): Promise<boolean> => {
        try {
            await api.delete(`/pipelines/${id}`);
            return true;
        } catch (e) {
            console.error('Failed to delete pipeline', e);
            return false;
        }
    },

    // --- STAGE METHODS ---

    // Create Stage
    createStage: async (pipelineId: string, stage: Partial<PipelineStage>): Promise<PipelineStage | null> => {
        return api.post(`/pipelines/${pipelineId}/stages`, stage);
    },

    // Update Stage
    updateStage: async (stageId: string, updates: Partial<PipelineStage>): Promise<PipelineStage | null> => {
        return api.put(`/pipelines/stages/${stageId}`, updates);
    },

    // Delete Stage
    deleteStage: async (stageId: string): Promise<boolean> => {
        try {
            await api.delete(`/pipelines/stages/${stageId}`);
            return true;
        } catch (e) {
            console.error('Failed to delete stage', e);
            return false;
        }
    }
};
