import { supabase } from '../lib/supabase';
import { AppConfig } from '../AppConfig';

export interface FormField {
    name: string;
    type: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options?: string[];
}

export interface Form {
    id: string;
    user_id: string;
    name: string;
    description?: string;
    form_token: string;
    is_active: boolean;
    fields: FormField[];
    pipeline_id?: string;
    stage_id?: string;
    styling: Record<string, any>;
    settings: Record<string, any>;
    success_message: string;
    submission_count: number;
    created_at: string;
}

export interface CreateFormRequest {
    name: string;
    description?: string;
    fields: FormField[];
    pipeline_id?: string;
    stage_id?: string;
    styling?: Record<string, any>;
    settings?: Record<string, any>;
    success_message?: string;
}

export interface FormSubmission {
    id: string;
    form_id: string;
    lead_id?: string;
    submission_data: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    submitted_at: string;
}

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const formService = {
    // Get all forms (authenticated)
    getForms: async (): Promise<Form[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/forms', { headers });
            if (!res.ok) throw new Error('Failed to fetch forms');
            return await res.json();
        } catch (e) {
            console.error('Failed to load forms', e);
            return [];
        }
    },

    // Get single form (authenticated)
    getForm: async (id: string): Promise<Form | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/forms/${id}`, { headers });
            if (!res.ok) throw new Error('Failed to load form');
            return await res.json();
        } catch (e) {
            console.error('Failed to load form', e);
            return null;
        }
    },

    getFormByToken: async (token: string): Promise<Partial<Form> | null> => {
        try {
            const API_URL = AppConfig.VITE_API_URL || '/api';
            const res = await fetch(`${API_URL}/forms/token/${token}`);
            if (!res.ok) throw new Error('Form not found');
            return await res.json();
        } catch (e) {
            console.error('Failed to load form by token', e);
            return null;
        }
    },

    // Create form (authenticated)
    createForm: async (form: CreateFormRequest): Promise<Form | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/forms', {
                method: 'POST',
                headers,
                body: JSON.stringify(form)
            });
            if (!res.ok) throw new Error('Failed to create form');
            return await res.json();
        } catch (e) {
            console.error('Failed to create form', e);
            return null;
        }
    },

    // Update form (authenticated)
    updateForm: async (id: string, updates: Partial<Form>): Promise<Form | null> => {
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
    },

    // Delete form (authenticated)
    deleteForm: async (id: string): Promise<boolean> => {
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
    },

    // Submit form (public - no auth required)
    submitForm: async (formToken: string, submissionData: Record<string, any>): Promise<any> => {
        try {
            const API_URL = AppConfig.VITE_API_URL || '/api';
            const res = await fetch(`${API_URL}/forms/submit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    form_token: formToken,
                    submission_data: submissionData
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
    },

    // Get form submissions (authenticated)
    getFormSubmissions: async (formId: string): Promise<FormSubmission[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/forms/${formId}/submissions`, { headers });
            if (!res.ok) throw new Error('Failed to load submissions');
            return await res.json();
        } catch (e) {
            console.error('Failed to load submissions', e);
            return [];
        }
    },

    // Generate form public URL
    getFormPublicUrl: (token: string): string => {
        return `${window.location.origin}/forms/${token}`;
    }
};
