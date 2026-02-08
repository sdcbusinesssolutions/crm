import { supabase } from '../lib/supabase';
import { tokenService } from './tokenService';
import {
    Pipeline,
    PipelineStage,
    Lead,
    FormDefinition,
    KanbanBoard,
    CreatePipelineRequest,
    CreateFormRequest,
} from '../types/lead-management';

// Helper to get auth headers
const getHeaders = async () => {
    const token = tokenService.getAccessToken();
    if (token) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''} `
    };
};

// =====================================================
// PIPELINE FUNCTIONS
// =====================================================

export const getPipelines = async (): Promise<Pipeline[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/pipelines', { headers });
        if (!res.ok) throw new Error('Failed to fetch pipelines');
        return await res.json();
    } catch (e) {
        console.error('Failed to load pipelines', e);
        throw e;
    }
};

export const getPipeline = async (id: string): Promise<Pipeline | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/pipelines/${id}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch pipeline');
        return await res.json();
    } catch (e) {
        console.error('Failed to load pipeline', e);
        return null;
    }
};

export const createPipeline = async (pipeline: CreatePipelineRequest): Promise<Pipeline> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/pipelines', {
            method: 'POST',
            headers,
            body: JSON.stringify(pipeline)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create pipeline');
        }
        return await res.json();
    } catch (e) {
        console.error('Failed to create pipeline', e);
        throw e;
    }
};

export const updatePipeline = async (id: string, updates: Partial<Pipeline>): Promise<Pipeline | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/pipelines/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update pipeline');
        return await res.json();
    } catch (e) {
        console.error('Failed to update pipeline', e);
        return null;
    }
};

export const deletePipeline = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/pipelines/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete pipeline');
        return true;
    } catch (e) {
        console.error('Failed to delete pipeline', e);
        return false;
    }
};

export const setPipelineAsDefault = async (id: string): Promise<Pipeline | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/pipelines/${id}/default`, {
            method: 'PUT',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.warning || 'Failed to set default pipeline');
        }
        return await res.json();
    } catch (e: any) {
        console.error('Failed to set default pipeline', e);
        throw e;
    }
};

// =====================================================
// STAGE FUNCTIONS
// =====================================================

export const getPipelineStages = async (pipelineId: string): Promise<PipelineStage[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/pipelines/${pipelineId}/stages`, { headers });
        if (!res.ok) throw new Error('Failed to fetch stages');
        return await res.json();
    } catch (e) {
        console.error('Failed to load stages', e);
        return [];
    }
};

export const createStage = async (pipelineId: string, stage: Partial<PipelineStage>): Promise<PipelineStage> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/stages', {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...stage, pipeline_id: pipelineId })
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
};

export const updateStage = async (id: string, updates: Partial<PipelineStage>): Promise<PipelineStage | null> => {
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
};

export const deleteStage = async (id: string): Promise<boolean> => {
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
};

// =====================================================
// LEAD FUNCTIONS
// =====================================================

export const getLeads = async (pipelineId?: string, stageId?: string, page: number = 1, limit: number = 50, filters?: any): Promise<Lead[]> => {
    try {
        const headers = await getHeaders();
        const params = new URLSearchParams();
        if (pipelineId) params.append('pipeline_id', pipelineId);
        if (stageId) params.append('stage_id', stageId);
        params.append('page', page.toString());
        params.append('limit', limit.toString());

        if (filters) {
            if (filters.search) params.append('search', filters.search);
            if (filters.sortBy) params.append('sortBy', filters.sortBy);
            if (filters.quickFilter && filters.quickFilter !== 'all') params.append('quickFilter', filters.quickFilter);
        }

        const url = `/api/leads${params.toString() ? '?' + params.toString() : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch leads');
        return await res.json();
    } catch (e) {
        console.error('Failed to load leads', e);
        return [];
    }
};

export const createLead = async (lead: Partial<Lead>): Promise<Lead> => {
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
};

export const moveLeadToStage = async (leadId: string, stageId: string): Promise<Lead | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/leads/${leadId}/move`, {
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
};

export const updateLead = async (id: string, updates: Partial<Lead>): Promise<Lead | null> => {
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
};

export const deleteLead = async (id: string): Promise<boolean> => {
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
};



// =====================================================
// KANBAN BOARD FUNCTIONS
// =====================================================

export const getKanbanBoard = async (pipelineId: string, page: number = 1, limit: number = 50, filters?: any): Promise<KanbanBoard> => {
    try {
        const headers = await getHeaders();
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString()
        });

        if (filters) {
            if (filters.search) params.append('search', filters.search);
            if (filters.sortBy) params.append('sortBy', filters.sortBy);
            if (filters.quickFilter && filters.quickFilter !== 'all') params.append('quickFilter', filters.quickFilter);
        }

        const res = await fetch(`/api/pipelines/${pipelineId}/kanban?${params.toString()}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch kanban board');
        return await res.json();
    } catch (e) {
        console.error('Failed to load kanban board', e);
        throw e;
    }
};

// =====================================================
// FORM FUNCTIONS
// =====================================================

export const getForms = async (): Promise<FormDefinition[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/forms', { headers });
        if (!res.ok) throw new Error('Failed to fetch forms');
        return await res.json();
    } catch (e) {
        console.error('Failed to load forms', e);
        throw e;
    }
};

export const getForm = async (id: string): Promise<FormDefinition | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/forms/${id}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch form');
        return await res.json();
    } catch (e) {
        console.error('Failed to load form', e);
        return null;
    }
};

export const createForm = async (form: CreateFormRequest): Promise<FormDefinition> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/forms', {
            method: 'POST',
            headers,
            body: JSON.stringify(form)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create form');
        }
        return await res.json();
    } catch (e) {
        console.error('Failed to create form', e);
        throw e;
    }
};

export const updateForm = async (id: string, updates: Partial<FormDefinition>): Promise<FormDefinition | null> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/forms/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update form');
        return await res.json();
    } catch (e) {
        console.error('Failed to update form', e);
        return null;
    }
};

export const deleteForm = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/forms/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete form');
        return true;
    } catch (e) {
        console.error('Failed to delete form', e);
        return false;
    }
};

export const getFormPublicUrl = (token: string): string => {
    return `${window.location.origin}/forms/${token}`;
};

export const getFormByToken = async (token: string): Promise<FormDefinition | null> => {
    try {
        const res = await fetch(`/api/forms/token/${token}`);
        if (!res.ok) throw new Error('Failed to fetch form');
        return await res.json();
    } catch (e) {
        console.error('Failed to load form by token', e);
        return null;
    }
};

export const submitForm = async (token: string, data: any): Promise<any> => {
    try {
        const res = await fetch('/api/forms/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                form_token: token,
                submission_data: data
            })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to submit form');
        }
        return await res.json();
    } catch (e) {
        console.error('Failed to submit form', e);
        throw e;
    }
};

export const reorderStages = async (stages: { id: string; display_order: number }[]): Promise<void> => {
    const headers = await getHeaders();
    const res = await fetch('/api/stages/reorder', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ stages })
    });
    if (!res.ok) throw new Error('Failed to reorder stages');
};

// =====================================================
// NOTES, TASKS, APPOINTMENTS FUNCTIONS
// =====================================================

export const getNotes = async (leadId: string): Promise<any[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/notes?lead_id=${leadId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch notes');
        return await res.json();
    } catch (e) {
        console.error('Failed to load notes', e);
        return [];
    }
};

export const createNote = async (note: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/notes', {
            method: 'POST',
            headers,
            body: JSON.stringify(note)
        });
        if (!res.ok) throw new Error('Failed to create note');
        return await res.json();
    } catch (e) {
        console.error('Failed to create note', e);
        throw e;
    }
};

export const updateNote = async (id: string, updates: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/notes/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update note');
        return await res.json();
    } catch (e) {
        console.error('Failed to update note', e);
        throw e;
    }
};

export const deleteNote = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/notes/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete note');
        return true;
    } catch (e) {
        console.error('Failed to delete note', e);
        return false;
    }
};

export const getTasks = async (leadId?: string): Promise<any[]> => {
    try {
        const headers = await getHeaders();
        const url = leadId ? `/api/tasks?lead_id=${leadId}` : '/api/tasks';
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Failed to fetch tasks');
        return await res.json();
    } catch (e) {
        console.error('Failed to load tasks', e);
        return [];
    }
};

export const createTask = async (task: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/tasks', {
            method: 'POST',
            headers,
            body: JSON.stringify(task)
        });
        if (!res.ok) throw new Error('Failed to create task');
        return await res.json();
    } catch (e) {
        console.error('Failed to create task', e);
        throw e;
    }
};

export const updateTask = async (id: string, updates: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update task');
        return await res.json();
    } catch (e) {
        console.error('Failed to update task', e);
        throw e;
    }
};

export const deleteTask = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/tasks/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete task');
        return true;
    } catch (e) {
        console.error('Failed to delete task', e);
        return false;
    }
};

export const getAppointments = async (leadId: string): Promise<any[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/appointments?lead_id=${leadId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch appointments');
        return await res.json();
    } catch (e) {
        console.error('Failed to load appointments', e);
        return [];
    }
};

export const createAppointment = async (appointment: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/appointments', {
            method: 'POST',
            headers,
            body: JSON.stringify(appointment)
        });
        if (!res.ok) throw new Error('Failed to create appointment');
        return await res.json();
    } catch (e) {
        console.error('Failed to create appointment', e);
        throw e;
    }
};

export const updateAppointment = async (id: string, updates: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/appointments/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update appointment');
        return await res.json();
    } catch (e) {
        console.error('Failed to update appointment', e);
        throw e;
    }
};

export const deleteAppointment = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/appointments/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete appointment');
        return true;
    } catch (e) {
        console.error('Failed to delete appointment', e);
        return false;
    }
};

export const getCallLogs = async (leadId: string): Promise<any[]> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/call-logs?lead_id=${leadId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch call logs');
        return await res.json();
    } catch (e) {
        console.error('Failed to load call logs', e);
        return [];
    }
};

export const createCallLog = async (callLog: any): Promise<any> => {
    try {
        const headers = await getHeaders();
        const res = await fetch('/api/call-logs', {
            method: 'POST',
            headers,
            body: JSON.stringify(callLog)
        });
        if (!res.ok) throw new Error('Failed to create call log');
        return await res.json();
    } catch (e) {
        console.error('Failed to create call log', e);
        throw e;
    }
};

export const deleteCallLog = async (id: string): Promise<boolean> => {
    try {
        const headers = await getHeaders();
        const res = await fetch(`/api/call-logs/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete call log');
        return true;
    } catch (e) {
        console.error('Failed to delete call log', e);
        return false;
    }
};
