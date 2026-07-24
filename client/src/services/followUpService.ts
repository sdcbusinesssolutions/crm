import { supabase } from '../lib/supabase';
import { tokenService } from './tokenService';

export interface FollowUp {
    id: string;
    contact_id: string;
    title: string;
    description?: string;
    scheduled_at: string;
    status: 'PENDING' | 'COMPLETED' | 'MISSED' | 'CANCELLED';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    type: 'CALL' | 'EMAIL' | 'WHATSAPP' | 'MEETING' | 'TASK';
    recurrence_rule?: any;
    created_at: string;
    created_by_staff_id?: string;
    created_by_name?: string;
    contacts?: {
        name: string;
        phone: string;
        email?: string;
        drip_enrollments?: Array<{
            id: string;
            status: string;
            stop_at: string;
            started_at: string;
            drip_campaign_id?: string;
            drip_campaigns?: {
                name: string;
            };
        }>;
    };
}

const getHeaders = async () => {
    const token = tokenService.getAccessToken();
    const commonHeaders = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
    };
    
    if (token) {
        return {
            ...commonHeaders,
            'Authorization': `Bearer ${token}`
        };
    }
    const { data: { session } } = await supabase.auth.getSession();
    return {
        ...commonHeaders,
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const followUpService = {
    async getFollowUps(filters: { contact_id?: string; status?: string; start_date?: string; end_date?: string } = {}) {
        const headers = await getHeaders();
        const params = new URLSearchParams();
        if (filters.contact_id) params.append('contact_id', filters.contact_id);
        if (filters.status) params.append('status', filters.status);
        if (filters.start_date) params.append('start_date', filters.start_date);
        if (filters.end_date) params.append('end_date', filters.end_date);

        const res = await fetch(`/api/follow-ups?${params.toString()}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch follow-ups');
        const json = await res.json();
        // Backend returns { data: [...] } or just [...]?
        // Checking followUps.js: router.get('/', ... res.json(data))
        // So it returns array directly.
        return json as FollowUp[];
    },

    async createFollowUp(followUp: Partial<FollowUp>) {
        const headers = await getHeaders();
        const res = await fetch('/api/follow-ups', {
            method: 'POST',
            headers,
            body: JSON.stringify(followUp)
        });
        if (!res.ok) throw new Error('Failed to create follow-up');
        return await res.json();
    },

    async updateFollowUp(id: string, updates: Partial<FollowUp>) {
        const headers = await getHeaders();
        const res = await fetch(`/api/follow-ups/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update follow-up');
        return await res.json();
    },

    async deleteFollowUp(id: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/follow-ups/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete follow-up');
        return true;
    }
};
