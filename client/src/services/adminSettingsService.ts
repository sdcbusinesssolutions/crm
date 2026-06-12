import { AppConfig } from '../AppConfig';

let API_URL = AppConfig.VITE_API_URL || '/api';

// Normalize absolute API URLs to ensure the '/api' suffix is appended if omitted
if (API_URL.startsWith('http') && !API_URL.endsWith('/api') && !API_URL.includes('/api/')) {
    API_URL = `${API_URL}/api`;
}

const getHeaders = () => {
    const token = localStorage.getItem('adminToken');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const adminSettingsService = {
    getOnboardingSettings: async () => {
        const headers = getHeaders();
        // Updated URL to point to Admin API
        const res = await fetch(`${API_URL}/admin/settings/onboarding`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                // Optional: Handle token expiration
                window.location.href = '/admin/auth/login';
            }
            throw new Error(err.message || 'Failed to fetch onboarding settings');
        }
        return res.json();
    },

    saveOnboardingSettings: async (data: any) => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/onboarding`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to save onboarding settings');
        }
        return res.json();
    },

    getSignupNotifications: async () => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/notifications`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                window.location.href = '/admin/auth/login';
            }
            throw new Error(err.message || 'Failed to fetch signup notification settings');
        }
        return res.json();
    },

    saveSignupNotifications: async (data: any) => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/notifications`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to save signup notification settings');
        }
        return res.json();
    },

    getSmtpSettings: async () => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/email`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            if (res.status === 401) {
                window.location.href = '/admin/auth/login';
            }
            throw new Error(err.message || 'Failed to fetch SMTP settings');
        }
        return res.json();
    },

    saveSmtpSettings: async (data: any) => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/email`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to save SMTP settings');
        }
        return res.json();
    },

    testSmtpSettings: async (config: any, testEmail: string) => {
        const headers = getHeaders();
        const res = await fetch(`${API_URL}/admin/settings/email/test`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ config, testEmail })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to test SMTP settings');
        }
        return res.json();
    }
};
