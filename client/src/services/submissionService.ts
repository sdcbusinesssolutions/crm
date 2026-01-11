import { tokenService } from './tokenService';

export interface Flow {
    id: string;
    name: string;
    status: string;
    categories: string[];
    submission_count?: number;
    updated_at?: string;
}

export interface Submission {
    id: string;
    flow_id: string;
    flow_name: string;
    contact_phone: string;
    contact_name: string;
    submission_data: any;
    submitted_at: string;
}

export const submissionService = {
    getFlows: async (): Promise<Flow[]> => {
        const token = tokenService.getAccessToken();
        const res = await fetch('/api/whatsapp/forms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to fetch flows');
        const data = await res.json();
        // The endpoint /api/whatsapp/forms usually returns { data: [...] } from Meta API
        return data.data || [];
    },

    getSubmissions: async (flowId: string): Promise<Submission[]> => {
        const token = tokenService.getAccessToken();
        const res = await fetch(`/api/whatsapp/forms/${flowId}/submissions`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to fetch submissions');
        return await res.json();
    },

    deleteSubmission: async (id: string): Promise<void> => {
        const token = tokenService.getAccessToken();
        const res = await fetch(`/api/whatsapp/forms/submissions/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) throw new Error('Failed to delete submission');
    },

    bulkDeleteSubmissions: async (ids: string[]): Promise<void> => {
        const token = tokenService.getAccessToken();
        const res = await fetch(`/api/whatsapp/forms/submissions/bulk`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ ids })
        });
        if (!res.ok) throw new Error('Failed to delete submissions');
    },

    updateSubmission: async (id: string, data: Partial<Submission>): Promise<Submission> => {
        const token = tokenService.getAccessToken();
        const res = await fetch(`/api/whatsapp/forms/submissions/${id}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to update submission');
        }
        return await res.json();
    }
};
