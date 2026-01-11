const API_URL = import.meta.env.VITE_API_URL || '/api';

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
    }
};
