import { AppConfig } from '../AppConfig';
import { supabase } from '../lib/supabase';

let API_URL = AppConfig.VITE_API_URL || '/api';

if (API_URL.startsWith('http') && !API_URL.endsWith('/api') && !API_URL.includes('/api/')) {
    API_URL = `${API_URL}/api`;
}

export const authNotificationsService = {
    getSettings: async (domain: string) => {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch(`${API_URL}/auth-notifications/settings?domain=${domain}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to fetch settings');
        }
        return res.json();
    },

    saveSettings: async (settings: any) => {
        const { data: session } = await supabase.auth.getSession();
        const token = session.session?.access_token;
        const res = await fetch(`${API_URL}/auth-notifications/settings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(settings)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Failed to save settings');
        }
        return res.json();
    }
};
