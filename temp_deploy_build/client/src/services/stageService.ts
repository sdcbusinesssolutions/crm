import { supabase } from '../lib/supabase';
import { PipelineStage } from './pipelineService';

// Helper to get auth headers
const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export interface CreateStageRequest {
    pipeline_id: string;
    name: string;
    description?: string;
    color?: string;
    display_order?: number;
}

export const stageService = {
    // Get all stages
    getStages: async (): Promise<PipelineStage[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/stages', { headers });
            if (!res.ok) throw new Error('Failed to fetch stages');
            return await res.json();
        } catch (e) {
            console.error('Failed to load stages', e);
            return [];
        }
    },

    // Create stage
    createStage: async (stage: CreateStageRequest): Promise<PipelineStage | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/stages', {
                method: 'POST',
                headers,
                body: JSON.stringify(stage)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create stage');
            }
            return await res.json();
        } catch (e) {
            console.error('Failed to create stage', e);
            throw e;
        }
    },

    // Update stage
    updateStage: async (id: string, updates: Partial<PipelineStage>): Promise<PipelineStage | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/stages/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error('Failed to update stage');
            return await res.json();
        } catch (e) {
            console.error('Failed to update stage', e);
            return null;
        }
    },

    // Reorder stages
    reorderStages: async (stages: Array<{ id: string; display_order: number }>): Promise<boolean> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/stages/reorder', {
                method: 'PUT',
                headers,
                body: JSON.stringify({ stages })
            });
            if (!res.ok) throw new Error('Failed to reorder stages');
            return true;
        } catch (e) {
            console.error('Failed to reorder stages', e);
            return false;
        }
    },

    // Delete stage
    deleteStage: async (id: string): Promise<boolean> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/stages/${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Failed to delete stage');
            return true;
        } catch (e) {
            console.error('Failed to delete stage', e);
            return false;
        }
    }
};
