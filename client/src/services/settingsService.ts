import { supabase } from '../lib/supabase';
import { tokenService } from './tokenService';
import { AppConfig } from '../AppConfig';

// Robust API URL resolution:
// If provided VITE_API_URL is 'localhost' but we are visiting via Ngrok/Public IP,
// we MUST use relative path '/api' to leverage the Vite Proxy and avoid Mixed Content (HTTPS -> HTTP) errors.
let API_URL = AppConfig.VITE_API_URL || '/api';

if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const apiIsLocal = API_URL.includes('localhost') || API_URL.includes('127.0.0.1');

    // If we are NOT on localhost (e.g. ngrok), but API is configured for localhost, force proxy usage.
    if (!isLocal && apiIsLocal) {
        console.log('Detected Public Access (Ngrok/VPS). Switching API_URL to relative "/api" to prevent Mixed Content errors.');
        API_URL = '/api';
    }
}

const getHeaders = async () => {
    // Prefer tokenService which is synced with App.tsx state
    const token = tokenService.getAccessToken();

    // Fallback: Check Supabase session directly if tokenService is empty (rare edge case)
    if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
            return {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`
            };
        }
        // If still no token, we can't authenticate.
        throw new Error("Auth session missing! Please reload.");
    }

    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
};

export const settingsService = {
    getWhatsAppConfig: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp`, { headers });
        if (!res.ok) throw new Error('Failed to fetch WhatsApp config');
        return res.json();
    },
    saveWhatsAppConfig: async (data: any) => { // Create
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to save WhatsApp config');
        }
        return res.json();
    },
    updateWhatsAppConfig: async (id: string, data: any) => { // Update
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to update WhatsApp config');
        }
        return res.json();
    },
    deleteWhatsAppConfig: async (id: string) => { // Delete
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/${id}`, {
            method: 'DELETE',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to delete WhatsApp config');
        }
        return res.json();
    },
    getWebhookSettings: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/webhook`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to fetch webhook settings');
        }
        return res.json();
    },
    saveWebhookToken: async (token: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/webhook`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ verifyToken: token })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to save verify token');
        }
        return res.json();
    },
    changePassword: async (data: any) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/change-password`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to change password');
        }
        return res.json();
    },
    get2FAStatus: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/2fa`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to fetch 2FA status');
        }
        return res.json();
    },
    generate2FA: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/2fa/generate`, {
            method: 'POST',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to generate 2FA key');
        }
        return res.json();
    },
    verify2FA: async (token: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/2fa/verify`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ token })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Verification failed');
        }
        return res.json();
    },
    enable2FA: async (token: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/2fa/enable`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ token })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to enable 2FA');
        }
        return res.json();
    },
    disable2FA: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/2fa/disable`, {
            method: 'POST',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to disable 2FA');
        }
        return res.json();
    },
    getOnboardingSettings: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/onboarding`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to fetch onboarding settings');
        }
        return res.json();
    },
    saveOnboardingSettings: async (data: any) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/onboarding`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to save onboarding settings');
        }
        return res.json();
    },
    getEmbeddedSignupConfig: async () => {
        const headers = await getHeaders();
        console.log('Fetching embedded config from:', `${API_URL}/settings/onboarding/config`);
        const res = await fetch(`${API_URL}/settings/onboarding/config`, { headers });
        console.log('Embedded config response status:', res.status, res.statusText);

        if (!res.ok) {
            const text = await res.text();
            console.error('Embedded config error body:', text);
            try {
                const err = JSON.parse(text);
                throw new Error(err.error || err.message || 'Failed to fetch embedded config');
            } catch (e) {
                throw new Error(`Failed to fetch embedded config: ${res.status} ${text}`);
            }
        }
        return res.json();
    },
    connectEmbeddedAccount: async (code: string, wabaId?: string, phoneId?: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/embedded-signup`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                code,
                waba_id: wabaId,
                phone_number_id: phoneId
            })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to connect embedded account');
        }
        return data;
    },
    updateWebhook: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/webhook/update`, {
            method: 'POST',
            headers
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to update webhook');
        }
        return data;
    },
    getDebugToken: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/token-debug`, { headers });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to fetch token debug info');
        return data;
    },
    extendToken: async () => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/token-extend`, {
            method: 'POST',
            headers
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to extend token');
        return data;
    },
    initiateMMLitePartnerOnboarding: async (accountId: string) => {
        const headers = await getHeaders();
        const response = await fetch(`${API_URL}/settings/whatsapp/mm-lite/partner-onboard/${accountId}`, {
            method: 'POST',
            headers
        });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to initiate partner onboarding');
        }
        return response.json();
    },

    checkMMLiteEligibility: async (accountId: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/mm-lite/eligibility/${accountId}`, { headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to check MM Lite eligibility');
        }
        return res.json();
    },
    transitionToMMLite: async (accountId: string) => {
        const headers = await getHeaders();
        const res = await fetch(`${API_URL}/settings/whatsapp/mm-lite/transition/${accountId}`, {
            method: 'POST',
            headers
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || err.message || 'Failed to transition to MM Lite');
        }
        return res.json();
    }
};
