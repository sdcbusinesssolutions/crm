
import { ContactGroup } from '../types';
import { supabase } from '../lib/supabase';

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        console.warn("contactGroupService: No access token found in session!");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const contactGroupService = {
    getGroups: async (): Promise<ContactGroup[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/groups', { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            return await res.json();
        } catch (e) {
            console.error("Error fetching groups", e);
            return [];
        }
    },

    saveGroup: async (group: ContactGroup): Promise<ContactGroup | null> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/groups', {
                method: 'POST',
                headers,
                body: JSON.stringify(group)
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("Error saving group", e);
            return null;
        }
    },

    deleteGroup: async (id: string): Promise<void> => {
        try {
            const headers = await getHeaders();
            await fetch(`/api/groups/${id}`, {
                method: 'DELETE',
                headers
            });
        } catch (e) {
            console.error("Error deleting group", e);
        }
    },

    exportGroupContacts: async (id: string): Promise<any[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/groups/${id}/export`, { headers });
            if (!res.ok) throw new Error('Failed to export contacts');
            return await res.json();
        } catch (e) {
            console.error("Error exporting group contacts", e);
            return [];
        }
    }
};
