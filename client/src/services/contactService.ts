
import { Contact } from '../types';
import { supabase } from '../lib/supabase';

const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
        console.warn("contactService: No access token found in session!");
        console.log("contactService: Session state:", session ? "exists but no token" : "null");
    } else {
        console.log("contactService: Token found, making authenticated request");
    }
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || ''}`
    };
};

export const contactService = {
    getContacts: async (): Promise<Contact[]> => {
        try {
            const headers = await getHeaders();
            const res = await fetch(`/api/contacts?t=${Date.now()}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch');
            return await res.json();
        } catch (e) {
            console.error("Failed to load contacts", e);
            return [];
        }
    },

    getContactsPaginated: async (
        page: number, 
        limit: number, 
        filters: { search?: string, groupId?: string, tag?: string, startDate?: string, endDate?: string, optStatus?: string } = {}
    ): Promise<{ data: Contact[], total: number }> => {
        try {
            const headers = await getHeaders();
            let url = `/api/contacts?page=${page}&limit=${limit}`;
            
            if (filters.search) url += `&search=${encodeURIComponent(String(filters.search).replace(/,/g, ''))}`;
            if (filters.groupId) url += `&groupId=${encodeURIComponent(filters.groupId)}`;
            if (filters.tag) url += `&tag=${encodeURIComponent(filters.tag)}`;
            if (filters.startDate) url += `&startDate=${encodeURIComponent(filters.startDate)}`;
            if (filters.endDate) url += `&endDate=${encodeURIComponent(filters.endDate)}`;
            if (filters.optStatus) url += `&optStatus=${encodeURIComponent(filters.optStatus)}`;

            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to fetch paginated contacts');
            return await res.json();
        } catch (e) {
            console.error("Failed to load paginated contacts", e);
            return { data: [], total: 0 };
        }
    },

    exportContacts: async (filters: { search?: string, groupId?: string, tag?: string, startDate?: string, endDate?: string, optStatus?: string } = {}): Promise<Contact[]> => {
        try {
            const headers = await getHeaders();
            let url = `/api/contacts/export?`;
            if (filters.search) url += `&search=${encodeURIComponent(String(filters.search).replace(/,/g, ''))}`;
            if (filters.groupId) url += `&groupId=${encodeURIComponent(filters.groupId)}`;
            if (filters.tag) url += `&tag=${encodeURIComponent(filters.tag)}`;
            if (filters.startDate) url += `&startDate=${encodeURIComponent(filters.startDate)}`;
            if (filters.endDate) url += `&endDate=${encodeURIComponent(filters.endDate)}`;
            if (filters.optStatus) url += `&optStatus=${encodeURIComponent(filters.optStatus)}`;

            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to export contacts');
            return await res.json();
        } catch (e) {
            console.error("Failed to export contacts", e);
            return [];
        }
    },

    saveContact: async (contact: Contact): Promise<void> => {
        try {
            const headers = await getHeaders();
            await fetch('/api/contacts', {
                method: 'POST',
                headers,
                body: JSON.stringify(contact)
            });
        } catch (e) {
            console.error("Failed to save contact", e);
        }
    },

    bulkCreateContacts: async (contacts: Partial<Contact>[]): Promise<any> => {
        console.log('🚀 Starting bulk import...', { count: contacts.length });
        const headers = await getHeaders();

        // Debug: Check if we have auth token
        const hasAuth = headers.Authorization && headers.Authorization !== 'Bearer ';
        console.log('🔐 Auth token present:', hasAuth);
        if (!hasAuth) {
            console.error('❌ NO AUTH TOKEN! User needs to sign in again.');
            throw new Error('Authentication required. Please sign out and sign in again.');
        }

        console.log('📡 Making request to /api/contacts/bulk');

        const res = await fetch('/api/contacts/bulk', {
            method: 'POST',
            headers,
            body: JSON.stringify(contacts)
        });

        console.log('📥 Response received:', {
            status: res.status,
            statusText: res.statusText,
            url: res.url
        });

        if (!res.ok) {
            let errorMessage = 'Failed to bulk save contacts';
            try {
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const err = await res.json();
                    errorMessage = err.error || err.message || errorMessage;
                    console.error('❌ Server error:', err);
                } else {
                    const text = await res.text();
                    console.error('Server returned non-JSON response:', text);
                    errorMessage = `Server error (${res.status}): ${res.statusText}`;
                }
            } catch (parseError) {
                console.error('Error parsing server response:', parseError);
            }
            throw new Error(errorMessage);
        }

        const responseData = await res.json();
        console.log('✅ Bulk import successful', responseData);
        return responseData;
    },

    deleteContact: async (id: string): Promise<void> => {
        try {
            const headers = await getHeaders();
            await fetch(`/api/contacts/${id}`, {
                method: 'DELETE',
                headers
            });
        } catch (e) {
            console.error("Failed to delete contact", e);
        }
    },

    bulkDeleteContacts: async (ids: string[]): Promise<void> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/contacts/bulk-delete', {
                method: 'POST',
                headers,
                body: JSON.stringify({ ids })
            });
            if (!res.ok) {
                let errMsg = 'Failed to delete contacts';
                try {
                    const errData = await res.json();
                    errMsg = errData.error || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }
        } catch (e) {
            console.error("Failed to bulk delete contacts", e);
            throw e;
        }
    },

    deleteFilteredContacts: async (filters: { search?: string, groupId?: string, tag?: string, startDate?: string, endDate?: string, optStatus?: string } = {}): Promise<number> => {
        try {
            const headers = await getHeaders();
            let url = `/api/contacts/bulk-delete-filtered?`;
            if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
            if (filters.groupId) url += `&groupId=${encodeURIComponent(filters.groupId)}`;
            if (filters.tag) url += `&tag=${encodeURIComponent(filters.tag)}`;
            if (filters.startDate) url += `&startDate=${encodeURIComponent(filters.startDate)}`;
            if (filters.endDate) url += `&endDate=${encodeURIComponent(filters.endDate)}`;
            if (filters.optStatus) url += `&optStatus=${encodeURIComponent(filters.optStatus)}`;

            const res = await fetch(url, { method: 'POST', headers });
            if (!res.ok) {
                let errMsg = 'Failed to delete filtered contacts';
                try {
                    const errData = await res.json();
                    errMsg = errData.error || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }
            const result = await res.json();
            return result.count || 0;
        } catch (e) {
            console.error("Failed to delete filtered contacts", e);
            throw e;
        }
    },

    deleteAllContacts: async (): Promise<number> => {
        try {
            const headers = await getHeaders();
            const res = await fetch('/api/contacts/bulk-delete-all', { method: 'POST', headers });
            if (!res.ok) {
                let errMsg = 'Failed to wipe CRM';
                try {
                    const errData = await res.json();
                    errMsg = errData.error || errMsg;
                } catch (_) {}
                throw new Error(errMsg);
            }
            const result = await res.json();
            return result.count || 0;
        } catch (e) {
            console.error("Failed to wipe CRM", e);
            throw e;
        }
    },

    getFilteredPhones: async (filters: { search?: string, groupId?: string, tag?: string, startDate?: string, endDate?: string, optStatus?: string } = {}): Promise<string[]> => {
        try {
            const headers = await getHeaders();
            let url = `/api/contacts/phones?`;
            if (filters.search) url += `&search=${encodeURIComponent(filters.search)}`;
            if (filters.groupId) url += `&groupId=${encodeURIComponent(filters.groupId)}`;
            if (filters.tag) url += `&tag=${encodeURIComponent(filters.tag)}`;
            if (filters.startDate) url += `&startDate=${encodeURIComponent(filters.startDate)}`;
            if (filters.endDate) url += `&endDate=${encodeURIComponent(filters.endDate)}`;
            if (filters.optStatus) url += `&optStatus=${encodeURIComponent(filters.optStatus)}`;

            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to fetch filtered phones');
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch filtered phones", e);
            return [];
        }
    }
};
