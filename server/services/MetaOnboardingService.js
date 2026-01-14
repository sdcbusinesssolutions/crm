const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { logOnboardingEvent } = require('../utils/logger');

// Initialize internal Supabase client for admin operations (fetching system settings)
const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY ? process.env.SUPABASE_SERVICE_KEY.trim() : '';

// Fail gracefully if env vars are missing (prevents crash on deployment)
let supabaseAdmin = null;
if (supabaseUrl && supabaseServiceKey) {
    try {
        supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    } catch (err) {
        console.error('Failed to initialize Supabase Admin client:', err.message);
    }
} else {
    console.warn('⚠️ MetaOnboardingService: SUPABASE_URL or SUPABASE_SERVICE_KEY missing. Admin operations will fail.');
}

class MetaOnboardingService {
    constructor() {
        this.graphApiUrl = 'https://graph.facebook.com/v20.0';
    }

    async getSystemSettings() {
        if (!supabaseAdmin) {
            console.error('MetaOnboardingService: Cannot fetch settings. Supabase Admin client not initialized.');
            throw new Error('System configuration error: Database connection not available.');
        }

        const { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', 'system')
            .single();

        if (error || !data) throw new Error('System onboarding settings not configured.');
        return data;
    }

    async getWabas(accessToken) {
        try {
            logOnboardingEvent('FETCH_WABAS_START', { accessToken: accessToken ? '***' : 'missing' });
            // 1. Try standard edge
            const response = await axios.get(`${this.graphApiUrl}/me`, {
                params: {
                    access_token: accessToken,
                    fields: 'whatsapp_business_accounts{id,name,currency,timezone_id}'
                }
            });
            if (response.data.whatsapp_business_accounts) {
                logOnboardingEvent('FETCH_WABAS_SUCCESS', { count: response.data.whatsapp_business_accounts.data.length });
                return response.data.whatsapp_business_accounts;
            }
        } catch (e) {
            logOnboardingEvent('FETCH_WABAS_STD_FAIL', { error: e.message });
            console.log('Standard WABA fetch failed, trying debug_token strategy...');
        }


        // 2. Fallback: Use debug_token to find granular scopes
        try {
            // Get settings and ensure they exist
            const settings = await this.getSystemSettings();
            if (!settings || !settings.embedded_app_id || !settings.embedded_app_secret) {
                console.log('Skipping debug_token fallback: Missing system app credentials');
                return { data: [] };
            }

            const appToken = `${settings.embedded_app_id}|${settings.embedded_app_secret}`;

            const debugRes = await axios.get(`${this.graphApiUrl}/debug_token`, {
                params: {
                    input_token: accessToken,
                    access_token: appToken
                }
            });

            const data = debugRes.data.data;
            const granularScopes = data.granular_scopes || [];

            // Find scope for whatsapp_business_management
            const wabaScope = granularScopes.find(s => s.scope === 'whatsapp_business_management');

            if (wabaScope && wabaScope.target_ids) {
                // We have IDs, but no names. Return meaningful objects.
                return {
                    data: wabaScope.target_ids.map(id => ({
                        id,
                        name: 'Embedded WABA (Auto-detected)',
                        currency: 'USD', // Unknown
                        timezone_id: 'UTC' // Unknown
                    }))
                };
            }

            return { data: [] };

        } catch (error) {
            console.error('WABA Detection Error:', error.response?.data || error.message);
            throw new Error('Failed to detect WABA accounts via token inspection.');
        }
    }

    async exchangeCodeForToken(code) {
        const settings = await this.getSystemSettings();

        try {
            logOnboardingEvent('EXCHANGE_TOKEN_START', { code: code ? '***' : 'missing' });
            const response = await axios.get(`${this.graphApiUrl}/oauth/access_token`, {
                params: {
                    client_id: settings.embedded_app_id,
                    client_secret: settings.embedded_app_secret,
                    code: code
                }
            });
            logOnboardingEvent('EXCHANGE_TOKEN_SUCCESS', { hasToken: !!response.data.access_token });
            return response.data; // contains access_token, machine_id, etc.
        } catch (error) {
            console.error('Meta OAuth Error:', error.response?.data || error.message);
            throw new Error('Failed to exchange code for access token: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    async getDebugToken(inputToken, accessToken) {
        try {
            const response = await axios.get(`${this.graphApiUrl}/debug_token`, {
                params: {
                    input_token: inputToken,
                    access_token: accessToken // App Access Token or User Access Token
                }
            });
            return response.data.data;
        } catch (error) {
            throw new Error('Failed to debug token');
        }
    }

    async getPhoneNumbers(wabaId, accessToken) {
        try {
            logOnboardingEvent('FETCH_PHONES_START', { wabaId });
            const response = await axios.get(`${this.graphApiUrl}/${wabaId}/phone_numbers`, {
                params: {
                    access_token: accessToken,
                    fields: 'display_phone_number,certificate,name_status,new_certificate,new_name_status,last_onboarded_time,platform_type,is_on_biz_app'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Get Phone Numbers Error:', error.response?.data || error.message);
            throw new Error('Failed to fetch phone numbers');
        }
    }

    async registerPhoneNumber(phoneNumberId, accessToken, pin) {
        try {
            logOnboardingEvent('REGISTER_PHONE_START', { phoneNumberId });
            const response = await axios.post(`${this.graphApiUrl}/${phoneNumberId}/register`, {
                messaging_product: 'whatsapp',
                pin: pin
            }, {
                params: { access_token: accessToken }
            });
            return response.data;
        } catch (error) {
            console.error('Register Phone Error:', error.response?.data || error.message);
            // It might already be registered, which is fine, but let's throw to handle specifically if needed
            throw new Error('Failed to register phone number: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    async unsubscribeAppFromWaba(wabaId, accessToken) {
        try {
            logOnboardingEvent('UNSUBSCRIBE_APP_START', { wabaId });
            await axios.delete(`${this.graphApiUrl}/${wabaId}/subscribed_apps`, {
                params: { access_token: accessToken }
            });
            return true;
        } catch (error) {
            console.warn('Unsubscribe App Warning (non-fatal):', error.response?.data || error.message);
            // Don't throw, just warn
            return false;
        }
    }

    async subscribeAppToWaba(wabaId, accessToken) {
        try {
            logOnboardingEvent('SUBSCRIBE_APP_START', { wabaId });
            // 1. Subscribe App to WABA
            await axios.post(`${this.graphApiUrl}/${wabaId}/subscribed_apps`, {}, {
                params: { access_token: accessToken }
            });
            return true;
        } catch (error) {
            console.error('Subscribe App Error:', error.response?.data || error.message);
            const metaError = error.response?.data?.error;
            const msg = metaError?.message || error.message;
            throw new Error(`Failed to subscribe app to WABA: ${msg}`);
        }
    }

    async overrideCallbackUrl(wabaId, accessToken, verifyToken, customBaseUrl = null) {
        try {
            // Robust Base URL Resolution: Try customBaseUrl -> SERVER_BASE_URL -> APP_URL -> CLIENT_URL
            let baseUrl = customBaseUrl || process.env.SERVER_BASE_URL || process.env.APP_URL || process.env.CLIENT_URL;
            if (baseUrl && baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1); // Remove trailing slash

            if (!baseUrl) {
                console.error('[MetaOnboarding] CRITICAL: No Base URL found (SERVER_BASE_URL, APP_URL, or CLIENT_URL). Webhook override will fail.');
                throw new Error('Server public URL not configured.');
            }

            const webhookUrl = `${baseUrl}/api/webhook`; // Global webhook
            // Ideally we want per-user webhook logic, but Meta WABA webhook is usually one per WABA if we override.
            // If we use the App's webhook, we don't need override.
            // The PHP code uses override. We will stick to that.

            logOnboardingEvent('OVERRIDE_WEBHOOK_START', { wabaId, webhookUrl });

            // NOTE: Logic here allows multiple users to use the Same App (Embedded Signup). 
            // The callback URL should probably point to our central webhook handler which dispatches based on WABA ID.

            await axios.post(`${this.graphApiUrl}/${wabaId}/subscribed_apps`, {
                override_callback_uri: webhookUrl,
                verify_token: verifyToken
            }, {
                params: { access_token: accessToken }
            });
            return true;
        } catch (error) {
            console.error('Override Webhook Error:', error.response?.data || error.message);
            // This might fail if the user doesn't have permissions or if we are using Test WABA
            console.warn('Webhook override failed. Continuing...');
            return false;
        }
    }
    async getAccessTokenInfo(inputToken, appToken) {
        try {
            // We need an App Access Token or User Access Token to debug
            // Construct request: GET /debug_token?input_token={token-to-inspect}&access_token={app-token-or-admin-token}

            // If appToken is not provided, we might need to fetch it or use the inputToken itself (which works if it's valid)
            const tokenToUse = appToken || inputToken;

            const response = await axios.get(`${this.graphApiUrl}/debug_token`, {
                params: {
                    input_token: inputToken,
                    access_token: tokenToUse
                }
            });
            // console.log('DEBUG TOKEN RESPONSE:', JSON.stringify(response.data, null, 2));
            return response.data.data;
        } catch (error) {
            console.error('Debug Token Error:', error.response?.data || error.message);
            throw new Error('Failed to debug access token');
        }
    }

    async extendAccessToken(shortLivedToken, appId, appSecret) {
        try {
            // Exchange short-lived token for long-lived one
            // GET /oauth/access_token?grant_type=fb_exchange_token&client_id={app-id}&client_secret={app-secret}&fb_exchange_token={short-lived-token}
            const response = await axios.get(`${this.graphApiUrl}/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: appId,
                    client_secret: appSecret,
                    fb_exchange_token: shortLivedToken
                }
            });
            return response.data; // { access_token: "...", token_type: "bearer", expires_in: ... }
        } catch (error) {
            console.error('Extend Token Error:', error.response?.data || error.message);
            throw new Error('Failed to extend access token');
        }
    }

    async triggerSmbDataSync(phoneNumberId, accessToken, type = 'smb_app_state_sync') {
        try {
            logOnboardingEvent('TRIGGER_SYNC_START', { phoneNumberId, type });
            const response = await axios.post(`${this.graphApiUrl}/${phoneNumberId}/smb_app_data`, {
                messaging_product: 'whatsapp',
                sync_type: type
            }, {
                headers: { 'Content-Type': 'application/json' },
                params: { access_token: accessToken }
            });
            return response.data;
        } catch (error) {
            console.error('Trigger Sync Error:', error.response?.data || error.message);
            // Don't throw fatal error as we can retry later or manual sync
            return null;
        }
    }
}

module.exports = new MetaOnboardingService();
