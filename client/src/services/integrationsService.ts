import { supabase } from '../lib/supabase';
import { AppConfig } from '../AppConfig';

// Helper to determine API URL
// Logic copied from settingsService to ensure Ngrok compatibility
let API_URL = AppConfig.VITE_API_URL || '/api';
if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiIsLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');

    // If we are NOT on localhost (e.g. ngrok), but API is configured for localhost, force proxy usage.
    if (!isLocal && apiIsLocal) {
        API_URL = '/api';
    }
}

export const integrationsService = {
    async getFacebookConfig() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return null;

        try {
            const res = await fetch(`${API_URL}/integrations/facebook/config`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn('Failed to fetch FB config', e);
            return null;
        }
    },

    async getFacebookStatus() {
        // Return mock data for now if backend is not ready to avoid crashes
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return { connected: false };

            const res = await fetch(`${API_URL}/integrations/facebook/status`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!res.ok) {
                // simple fallback
                return { connected: false };
            }
            return await res.json();
        } catch (e) {
            console.warn('Backend integration status check failed, defaulting to disconnected');
            return { connected: false };
        }
    },

    async connectFacebook(shortLivedToken?: string, code?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        // Allow either access_token or code
        const payload: any = {};
        if (shortLivedToken) payload.access_token = shortLivedToken;
        if (code) payload.code = code;

        const res = await fetch(`${API_URL}/integrations/facebook/connect`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to connect');
        }
        return await res.json();
    },

    async getFacebookPages() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        try {
            const res = await fetch(`${API_URL}/integrations/facebook/pages`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.warn('Failed to fetch pages', e);
            return [];
        }
    },

    async toggleFacebookPage(pageId: string, connect: boolean) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/facebook/pages/${pageId}/toggle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ connect })
        });

        if (!res.ok) {
            throw new Error('Failed to toggle page subscription');
        }
        return await res.json();
    },

    async getLeadForms(pageId: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        try {
            const res = await fetch(`${API_URL}/integrations/facebook/pages/${pageId}/forms`, {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            if (!res.ok) return [];
            return await res.json();
        } catch (e) {
            console.warn('Failed to fetch lead forms', e);
            return [];
        }
    },

    async syncLeads(pageId: string, formId: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/facebook/leads/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ pageId, formId })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to sync leads');
        }
        return await res.json();
    },

    // --- Google Integrations ---

    async getGoogleAuthUrl(clientId?: string, redirectUrl?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const params = { clientId, redirectUrl };
        const res = await fetch(`${API_URL}/integrations/google/auth-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(params)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get auth url');
        }
        return await res.json();
    },

    async exchangeGoogleCode(payload: { code: string, clientId?: string, clientSecret?: string, redirectUrl?: string, connectionName?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/google/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to exchange code');
        }
        return await res.json();
    },

    async getGoogleConnections() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const res = await fetch(`${API_URL}/integrations/google/connections`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) return [];
        return await res.json();
    },

    async saveServiceAccount(payload: { connectionName: string, credentials: any }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/google/service-account`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save Service Account');
        }
        return await res.json();
    },

    async deleteGoogleConnection(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/google/connections/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) throw new Error('Failed to delete connection');
        return await res.json();
    },

    // --- Gmail Integrations ---

    async getGmailAuthUrl(clientId?: string, redirectUrl?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const params = { clientId, redirectUrl };
        const res = await fetch(`${API_URL}/integrations/gmail/auth-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(params)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get auth url');
        }
        return await res.json();
    },

    async exchangeGmailCode(payload: { code: string, clientId?: string, clientSecret?: string, redirectUrl?: string, connectionName?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/gmail/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to exchange code');
        }
        return await res.json();
    },

    async getGmailConnections() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const res = await fetch(`${API_URL}/integrations/gmail/connections`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) return [];
        return await res.json();
    },

    async deleteGmailConnection(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/gmail/connections/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) throw new Error('Failed to delete connection');
        return await res.json();
    },

    async sendGmailEmail(connectionId: string, to: string, subject: string, body: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/gmail/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ connectionId, to, subject, body })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to send email');
        }
        return await res.json();
    },

    // --- Google Calendar Integrations ---

    async getCalendarAuthUrl(clientId?: string, redirectUrl?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const params = { clientId, redirectUrl };
        const res = await fetch(`${API_URL}/integrations/calendar/auth-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(params)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get auth url');
        }
        return await res.json();
    },

    async exchangeCalendarCode(payload: { code: string, clientId?: string, clientSecret?: string, redirectUrl?: string, connectionName?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/calendar/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to exchange code');
        }
        return await res.json();
    },

    async getCalendarConnections() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const res = await fetch(`${API_URL}/integrations/calendar/connections`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) return [];
        return await res.json();
    },

    async deleteCalendarConnection(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/calendar/connections/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) throw new Error('Failed to delete connection');
        return await res.json();
    },

    // --- Google Contacts Integrations ---

    async getContactsAuthUrl(clientId?: string, redirectUrl?: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const params = { clientId, redirectUrl };
        const res = await fetch(`${API_URL}/integrations/contacts/auth-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(params)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to get auth url');
        }
        return await res.json();
    },

    async exchangeContactsCode(payload: { code: string, clientId?: string, clientSecret?: string, redirectUrl?: string, connectionName?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/contacts/exchange`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to exchange code');
        }
        return await res.json();
    },

    async getContactsConnections() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const res = await fetch(`${API_URL}/integrations/contacts/connections`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) return [];
        return await res.json();
    },

    async deleteContactsConnection(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/contacts/connections/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) throw new Error('Failed to delete connection');
        return await res.json();
    },

    // --- SMTP Integrations ---

    async saveSmtpConnection(data: { name?: string, host: string, port: string, user: string, pass: string, fromEmail?: string }) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/smtp/connection`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify(data)
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to save connection');
        }
        return await res.json();
    },

    async getSmtpConnections() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return [];

        const res = await fetch(`${API_URL}/integrations/smtp/connections`, {
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) return [];
        return await res.json();
    },

    async deleteSmtpConnection(id: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/smtp/connections/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.access_token}` }
        });

        if (!res.ok) throw new Error('Failed to delete connection');
        return await res.json();
    },

    async sendSmtpEmail(connectionId: string, to: string, subject: string, body: string) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const res = await fetch(`${API_URL}/integrations/smtp/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ connectionId, to, subject, body })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to send email');
        }
        return await res.json();
    }
};
