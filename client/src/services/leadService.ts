import { supabase } from '../lib/supabase';

// Helper to get auth headers
const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export interface Lead {
    id: string;
    user_id: string;
    pipeline_id?: string;
    stage_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    tags: string[];
    custom_data: Record<string, any>;
    status: string;
    priority: string;
    estimated_value?: number;
    source: string;
    created_at: string;
}

export interface CreateLeadRequest {
    pipeline_id?: string;
    stage_id?: string;
    name?: string;
    email?: string;
    phone?: string;
    company?: string;
    tags?: string[];
    custom_data?: Record<string, any>;
    status?: string;
    priority?: string;
    estimated_value?: number;
    source?: string;
}

export const leadService = {
    // Get all leads (optionally filtered by pipeline or stage)
    getLeads: async (pipelineId?: string, stageId?: string): Promise<Lead[]> => {
        try {
            const headers = await getHeaders();
            const params = new URLSearchParams();
            if (pipelineId) params.append('pipeline_id', pipelineId);
            if (stageId) params.append('stage_id', stageId);

            const url = `/api/leads${params.toString() ? '?' + params.toString() : ''}`;
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to fetch leads');
            return await res.json();
        } catch (e) {
            console.error('Failed to load leads', e);
            return [];
        }
    },

    // Get single lead
    getLead: async (id: string): Promise<Lead | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/leads/${id}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch lead');
            return await res.json();
        } catch (e) {
            console.error('Failed to load lead', e);
            return null;
        }
    },

    // Create lead
    createLead: async (lead: CreateLeadRequest): Promise<Lead | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/leads', {
                method: 'POST',
                headers,
                body: JSON.stringify(lead)
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || 'Failed to create lead');
            }
            return await res.json();
        } catch (e) {
            console.error('Failed to create lead', e);
            throw e;
        }
    },

    // Update lead
    updateLead: async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error('Failed to update lead');
            return await res.json();
        } catch (e) {
            console.error('Failed to update lead', e);
            return null;
        }
    },

    // Move lead to different stage
    moveLead: async (id: string, stageId: string): Promise<Lead | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/leads/${id}/move`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ stage_id: stageId })
            });
            if (!res.ok) throw new Error('Failed to move lead');
            return await res.json();
        } catch (e) {
            console.error('Failed to move lead', e);
            return null;
        }
    },

    // Delete lead
    deleteLead: async (id: string): Promise<boolean> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/leads/${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Failed to delete lead');
            return true;
        } catch (e) {
            console.error('Failed to delete lead', e);
            return false;
        }
    }
};
