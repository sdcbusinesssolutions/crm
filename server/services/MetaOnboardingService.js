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
        this.graphApiUrl = 'https://graph.facebook.com/v21.0';
    }

    async getSystemSettings(targetDomain) {
        if (!supabaseAdmin) {
            console.error('MetaOnboardingService: Cannot fetch settings. Supabase Admin client not initialized.');
            throw new Error('System configuration error: Database connection not available.');
        }

        let { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', 'system')
            .eq('domain', targetDomain)
            .single();

        if (error || !data) {
            console.warn(`[MetaService] No settings found for domain: ${targetDomain}.`);
            return null;
        }

        return data;
    }

    async getWabas(accessToken, targetDomain) {
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
            const settings = await this.getSystemSettings(targetDomain);
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

    async getWabaInfo(wabaId, accessToken) {
        try {
            const response = await axios.get(`${this.graphApiUrl}/${wabaId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,name,owner_business_info'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Get WABA Info Error:', error.response?.data || error.message);
            // Don't throw if we want to fallback gracefully elsewhere, but let's throw for now
            throw new Error('Failed to fetch WABA info: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    async exchangeCodeForToken(code, targetDomain = 'clickube.com') {
        const settings = await this.getSystemSettings(targetDomain);

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
    async initiateMMLitePartnerOnboarding(businessId, accessToken, solutionId = null, targetDomain) {
        try {
            logOnboardingEvent('MMLITE_PARTNER_ONBOARD_START', { businessId, solutionId });
            
            const url = `${this.graphApiUrl}/${businessId}/onboard_partners_to_mm_lite`;
            
            const systemSettings = await this.getSystemSettings(targetDomain).catch(() => null);
            
            // 1. Resolve Master System User Token (SUAT) for the Partner call
            // Meta guidelines: Partners must use a System User Access Token for the App to call the Intent API
            let partnerAccessToken = accessToken; // Default to client token as fallback
            if (systemSettings && systemSettings.meta_access_token) {
                partnerAccessToken = systemSettings.meta_access_token;
                console.log(`[MM Lite] Using Partner System User Token for domain: ${targetDomain}`);
            }

            // 2. Resolve Solution ID (Tech Partner App ID)
            // Priority: System Settings for Domain -> Passed solutionId -> Fallback
            let finalSolutionId = solutionId;
            if (systemSettings && systemSettings.embedded_app_id) {
                finalSolutionId = systemSettings.embedded_app_id;
                console.log(`[MM Lite] Using Partner App ID as Solution ID: ${finalSolutionId}`);
            }

            const params = {
                access_token: partnerAccessToken
            };
            
            const body = {};
            if (finalSolutionId) {
                body.solution_id = finalSolutionId;
            }

            // Meta documentation specifies the solution_id should be in the request BODY
            const response = await axios.post(url, body, { params });
            
            logOnboardingEvent('MMLITE_PARTNER_ONBOARD_SUCCESS', { businessId, requestId: response.data.request_id });
            return response.data;
        } catch (error) {
            const metaError = error.response?.data?.error;
            const errorMsg = metaError?.message || error.message;
            const errorCode = metaError?.code;

            console.log(`[MM Lite] Debug Meta Error - Code: ${errorCode}, Msg: ${errorMsg}`);

            // Special case: Client already onboarded (error code 136031 or message contains it)
            if (errorCode === 136031 || errorMsg.includes('136031')) {
                console.log(`[MM Lite] Client already onboarded at business level. Proceeding...`);
                return { 
                    success: true, 
                    already_onboarded: true, 
                    message: 'Client has already accepted terms of service at the business level.' 
                };
            }

            console.error('MM Lite Partner Onboarding Error:', error.response?.data || error.message);
            throw new Error('Failed to initiate MM Lite partner onboarding: ' + errorMsg);
        }
    }

    async checkMMLiteEligibility(wabaId, accessToken, phoneNumberId = null) {
        try {
            console.log(`[MM Lite] Checking eligibility for WABA: ${wabaId}${phoneNumberId ? ' and Phone: ' + phoneNumberId : ''}`);
            
            // 1. Fetch WABA level status
            const wabaResponse = await axios.get(`${this.graphApiUrl}/${wabaId}`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,marketing_messages_onboarding_status,marketing_messages_lite_api_status,owner_business_info'
                }
            });
            console.log(`[MM Lite] WABA Eligibility Response:`, JSON.stringify(wabaResponse.data));

            // Normalize the status.
            let mmStatus = wabaResponse.data.marketing_messages_onboarding_status || 
                           wabaResponse.data.marketing_messages_lite_api_status || 
                           'NOT_STARTED';
            
            if (typeof mmStatus === 'object' && mmStatus !== null) {
                mmStatus = mmStatus.status || 'NOT_STARTED';
            }

            // Check BM level if WABA level is not enough
            let bmStatus = 'NOT_STARTED';
            if (wabaResponse.data.owner_business_info?.marketing_messages_onboarding_status) {
                const bmOnboarding = wabaResponse.data.owner_business_info.marketing_messages_onboarding_status;
                bmStatus = typeof bmOnboarding === 'object' ? bmOnboarding.status : bmOnboarding;
            }

            // 2. Fetch Phone level status if provided
            let phoneStatus = 'UNKNOWN';
            if (phoneNumberId) {
                try {
                    const phoneRes = await axios.get(`${this.graphApiUrl}/${phoneNumberId}`, {
                        params: {
                            access_token: accessToken,
                            fields: 'marketing_messages_lite_api_status,marketing_messages_onboarding_status'
                        }
                    });
                    // Prioritize the newer onboarding status, then the lite_api status
                    phoneStatus = phoneRes.data.marketing_messages_onboarding_status || 
                                  phoneRes.data.marketing_messages_lite_api_status || 
                                  'NOT_STARTED';

                    if (typeof phoneStatus === 'object') phoneStatus = phoneStatus.status || 'NOT_STARTED';
                    
                    console.log(`[MM Lite] Phone Status for ${phoneNumberId}: ${phoneStatus}`);
                } catch (pe) {
                    console.warn(`[MM Lite] Could not fetch phone-level status: ${pe.message}`);
                }
            }

            return {
                id: wabaResponse.data.id || wabaId,
                marketing_messages_onboarding_status: mmStatus,
                bm_status: bmStatus,
                phone_status: phoneStatus,
                // Map to old field for compatibility with existing routes
                marketing_messages_lite_onboarding_status: mmStatus === 'ONBOARDED' ? 'APPROVED' : mmStatus
            };
        } catch (error) {
            const metaError = error.response?.data?.error;
            const metaMsg = metaError?.message || error.message;
            const metaCode = metaError?.code;

            console.error('MM Lite Eligibility Check Error:', metaError || error.message);

            if (error.response?.status === 400 && 
                (metaMsg.includes('field') || metaMsg.includes('permission') || metaCode === 100)) {
                console.log('[MM Lite] Field not accessible or missing. Assuming NOT_STARTED.');
                return {
                    id: wabaId,
                    marketing_messages_onboarding_status: 'NOT_STARTED',
                    bm_status: 'NOT_STARTED',
                    marketing_messages_lite_onboarding_status: 'NOT_STARTED',
                    phone_status: 'NOT_STARTED'
                };
            }

            throw new Error('Failed to check MM Lite eligibility: ' + metaMsg);
        }
    }

    async transitionNumberToMMLite(phoneNumberId, accessToken, wabaId = null, targetDomain, metaAppId = null) {
        try {
            logOnboardingEvent('TRANSITION_MMLITE_START', { phoneNumberId, wabaId });
            
            if (!phoneNumberId) {
                throw new Error('Phone Number ID is required for MM Lite transition.');
            }

            const systemSettings = await this.getSystemSettings(targetDomain).catch(() => null);

            // 1. Resolve Solution ID for the Transition
            let partnerAppId = metaAppId;
            if (systemSettings && systemSettings.embedded_app_id) {
                partnerAppId = systemSettings.embedded_app_id;
            }

            // --- STRATEGY: FIELD UPDATES (More robust for modern Graph API activation) ---
            // Instead of targeting the /marketing_messages edge, we update the status field directly on the objects.
            
            const commonParams = {
                access_token: accessToken,
                messaging_product: 'whatsapp',
                solution_id: partnerAppId
            };

            const errors = [];

            // Attempt 1: POST to Phone ID directly (Status field)
            try {
                console.log(`[MM Lite] Attempting Phone Field Update for ${phoneNumberId}...`);
                const phoneRes = await axios.post(`${this.graphApiUrl}/${phoneNumberId}`, {
                    marketing_messages_lite_api_status: 'ONBOARDED'
                }, { params: commonParams });
                
                console.log(`[MM Lite] Phone Field Update Success:`, phoneRes.data);
                logOnboardingEvent('TRANSITION_MMLITE_PHONE_FIELD_SUCCESS', { phoneNumberId });
                return phoneRes.data;
            } catch (e1) {
                errors.push(`Phone Field: ${e1.response?.data?.error?.message || e1.message}`);
            }

            // Attempt 2: POST to Phone Edge (Status parameter)
            try {
                console.log(`[MM Lite] Attempting Phone Edge Transition for ${phoneNumberId}...`);
                const edgeRes = await axios.post(`${this.graphApiUrl}/${phoneNumberId}/marketing_messages`, {}, { 
                    params: { ...commonParams, status: 'ONBOARDED' }
                });
                console.log(`[MM Lite] Phone Edge Success:`, edgeRes.data);
                return edgeRes.data;
            } catch (e2) {
                errors.push(`Phone Edge: ${e2.response?.data?.error?.message || e2.message}`);
            }

            if (wabaId) {
                // Attempt 3: POST to WABA ID directly (Status field)
                try {
                    console.log(`[MM Lite] Attempting WABA Field Update for ${wabaId}...`);
                    const wabaRes = await axios.post(`${this.graphApiUrl}/${wabaId}`, {
                        marketing_messages_onboarding_status: 'ONBOARDED'
                    }, { params: commonParams });
                    
                    console.log(`[MM Lite] WABA Field Update Success:`, wabaRes.data);
                    return wabaRes.data;
                } catch (e3) {
                    errors.push(`WABA Field: ${e3.response?.data?.error?.message || e3.message}`);
                }

                // Attempt 4: POST to WABA Edge (Status parameter)
                try {
                    console.log(`[MM Lite] Attempting WABA Edge Transition for ${wabaId}...`);
                    const edgeWabaRes = await axios.post(`${this.graphApiUrl}/${wabaId}/marketing_messages`, {}, {
                        params: { ...commonParams, status: 'ONBOARDED' }
                    });
                    console.log(`[MM Lite] WABA Edge Success:`, edgeWabaRes.data);
                    return edgeWabaRes.data;
                } catch (e4) {
                    errors.push(`WABA Edge: ${e4.response?.data?.error?.message || e4.message}`);
                }
            }

            throw new Error('All transition attempts failed: ' + errors.join('; '));

        } catch (error) {
            const metaError = error.response?.data?.error;
            const metaMsg = metaError?.message || error.message;
            const errorCode = metaError?.code;

            console.error('MM Lite Number Transition Error:', metaError || error.message);

            // Special case: Client already onboarded at business level (error code 136031)
            // This is actually a success state for us.
            if (errorCode === 136031 || metaMsg.includes('136031')) {
                console.log(`[MM Lite] Client already onboarded for ${phoneNumberId}. Proceeding as success.`);
                return { 
                    success: true, 
                    already_onboarded: true, 
                    message: 'Client already onboarded at business level.' 
                };
            }

            throw new Error('Failed to transition number to MM Lite: ' + metaMsg);
        }
    }
}

module.exports = new MetaOnboardingService();
