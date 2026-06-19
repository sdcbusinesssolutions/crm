import { tokenService } from './tokenService';
import { supabase } from '../lib/supabase';

export interface DripCampaign {
    id: string;
    name: string;
    description?: string;
    trigger_type: 'TAG_ADDED' | 'PIPELINE_STAGE_CHANGED' | 'MANUAL';
    trigger_value?: string;
    status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
    schedule_config?: any;
    stop_on_reply: boolean;
    created_at: string;
    steps?: DripStep[];
    enrollment_count?: number;

    // New V2 Fields
    allowed_days: string; // "0,1,2,3,4,5,6"
    time_window_start: string; // "09:00"
    time_window_end: string; // "18:00"
    allow_reentry?: boolean;
}

export interface DripStep {
    id: string;
    campaign_id: string;
    step_order: number;
    step_type: 'WHATSAPP_MESSAGE' | 'EMAIL' | 'WAIT' | 'CONDITION' | 'AI_INTENT';
    step_config: any;

    // Legacy support (optional now)
    delay_hours?: number;

    // New V2 Fields
    delay_value: number;
    delay_unit: 'MINUTES' | 'HOURS' | 'DAYS' | 'WEEKS';

    use_custom_schedule?: boolean;
    custom_allowed_days?: string;
    custom_time_start?: string;
    custom_time_end?: string;
}

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

export const dripCampaignService = {
    async getCampaigns() {
        const headers = await getHeaders();
        const res = await fetch('/api/drip-campaigns', { headers });
        if (!res.ok) throw new Error('Failed to fetch campaigns');
        return await res.json() as DripCampaign[];
    },

    async getCampaign(id: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${id}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch campaign');
        return await res.json() as DripCampaign;
    },

    async createCampaign(campaign: Partial<DripCampaign>) {
        const headers = await getHeaders();
        const res = await fetch('/api/drip-campaigns', {
            method: 'POST',
            headers,
            body: JSON.stringify(campaign)
        });
        if (!res.ok) throw new Error('Failed to create campaign');
        return await res.json();
    },

    async updateCampaign(id: string, updates: Partial<DripCampaign>) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update campaign');
        return await res.json();
    },

    async deleteCampaign(id: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete campaign');
        return true;
    },

    // Step Management
    async createStep(campaignId: string, step: Partial<DripStep>) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${campaignId}/steps`, {
            method: 'POST',
            headers,
            body: JSON.stringify(step)
        });
        if (!res.ok) throw new Error('Failed to create step');
        return await res.json();
    },

    async updateStep(campaignId: string, stepId: string, updates: Partial<DripStep>) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${campaignId}/steps/${stepId}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update step');
        return await res.json();
    },

    async deleteStep(campaignId: string, stepId: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${campaignId}/steps/${stepId}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete step');
        return true;
    },

    // Enrollment
    async enrollContacts(campaignId: string, contactIds: string[], stopAt?: string, notificationRules?: any[], isLooping?: boolean) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${campaignId}/enroll`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                contact_ids: contactIds,
                stop_at: stopAt,
                notification_rules: notificationRules,
                is_looping: isLooping
            })
        });
        if (!res.ok) throw new Error('Failed to enroll contacts');
        return await res.json();
    },

    async getEnrollments(campaignId: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${campaignId}/enrollments`, { headers });
        if (!res.ok) throw new Error('Failed to fetch enrollments');
        return await res.json();
    },

    async stopEnrollment(enrollmentId: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/enrollments/${enrollmentId}/stop`, {
            method: 'POST',
            headers
        });
        if (!res.ok) throw new Error('Failed to stop enrollment');
        return true;
    },

    async deleteEnrollment(enrollmentId: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/enrollments/${enrollmentId}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) throw new Error('Failed to delete enrollment');
        return true;
    },

    async syncCampaign(id: string) {
        const headers = await getHeaders();
        const res = await fetch(`/api/drip-campaigns/${id}/sync`, {
            method: 'POST',
            headers
        });
        if (!res.ok) throw new Error('Failed to sync campaign');
        return await res.json();
    }
};
