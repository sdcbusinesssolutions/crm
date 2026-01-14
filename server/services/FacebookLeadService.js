const axios = require('axios');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { logFacebookLeadEvent } = require('../utils/logger');

class FacebookLeadService {
    constructor() {
        // We prefer env vars, but will fallback to DB settings
        this.envAppId = process.env.FACEBOOK_APP_ID;
        this.envAppSecret = process.env.FACEBOOK_APP_SECRET;
        this.envConfigId = process.env.FACEBOOK_CONFIG_ID;
        this.cachedCredentials = null;
    }

    async getAppCredentials() {
        // 1. Return Env vars if ALL exist (AppID + Secret). ConfigID is optional but good to have.
        if (this.envAppId && this.envAppSecret) {
            return {
                appId: this.envAppId,
                appSecret: this.envAppSecret,
                configId: this.envConfigId
            };
        }

        // 2. Return cached DB credentials if available
        if (this.cachedCredentials) {
            return this.cachedCredentials;
        }

        // 3. Fetch from DB
        try {
            console.log('[FacebookLeadService] Querying Supabase onboarding_settings...');
            const { data, error } = await supabaseAdmin
                .from('onboarding_settings')
                .select('embedded_app_id, embedded_app_secret, embedded_config_id')
                .eq('user_id', 'system')
                .single();

            if (error || !data) {
                console.warn('[FacebookLeadService] Facebook Creds: Not in Env and not in DB:', error?.message);
                // Return what we have
                return {
                    appId: this.envAppId,
                    appSecret: this.envAppSecret,
                    configId: this.envConfigId
                };
            }

            // Cache it
            // Cache it
            this.cachedCredentials = {
                appId: this.envAppId || data.embedded_app_id,
                appSecret: this.envAppSecret || data.embedded_app_secret,
                // FORCE Lead Config ID as requested by user to ensure separation from WhatsApp Config
                configId: '799224023176669'
            };
            console.log('[FacebookLeadService] Credentials loaded. Config ID enforced: 799224023176669');
            return this.cachedCredentials;

        } catch (e) {
            console.error('[FacebookLeadService] Failed to fetch system app settings:', e.message);
            // Even in error/fallback, try to provide the correct Config ID if possible, though appId might be missing
            return {
                appId: this.envAppId,
                appSecret: this.envAppSecret,
                configId: '799224023176669'
            };
        }
    }

    async exchangeToken(shortLivedToken, userId = 'unknown') {
        logFacebookLeadEvent('EXCHANGE_TOKEN_START', { userId, shortLivedToken: '***' });
        console.log('[FacebookLeadService] Exchanging short-lived token...');
        try {
            const { appId, appSecret } = await this.getAppCredentials();

            if (!appSecret) {
                const msg = 'FACEBOOK_APP_SECRET is missing. Exchange may fail.';
                console.warn(`[FacebookLeadService] ${msg}`);
                logFacebookLeadEvent('EXCHANGE_TOKEN_WARN', { userId, message: msg });
            }

            const url = `https://graph.facebook.com/v20.0/oauth/access_token`;
            const params = {
                grant_type: 'fb_exchange_token',
                client_id: appId,
                client_secret: appSecret,
                fb_exchange_token: shortLivedToken
            };

            const response = await axios.get(url, { params, timeout: 20000 });
            logFacebookLeadEvent('EXCHANGE_TOKEN_SUCCESS', { userId });
            return response.data.access_token;
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('[FacebookLeadService] Exchange Token Error:', errMsg);
            logFacebookLeadEvent('EXCHANGE_TOKEN_ERROR', { userId, error: errMsg });
            throw new Error('Failed to exchange access token');
        }
    }

    async exchangeCodeForToken(code, userId = 'unknown') {
        logFacebookLeadEvent('EXCHANGE_CODE_START', { userId, code: '***' });
        console.log('[FacebookLeadService] Exchanging authorization code...');
        try {
            const { appId, appSecret } = await this.getAppCredentials();

            const url = `https://graph.facebook.com/v20.0/oauth/access_token`;
            const params = {
                client_id: appId,
                client_secret: appSecret,
                code: code
                // NOTE: redirect_uri is NOT needed when using Config ID with JS SDK
                // The SDK handles the redirect internally and doesn't require it for code exchange
            };

            console.log('[FacebookLeadService] Exchange params:', { client_id: appId, code: '***' });
            const response = await axios.get(url, { params, timeout: 20000 });
            logFacebookLeadEvent('EXCHANGE_CODE_SUCCESS', { userId });
            return response.data.access_token;
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('[FacebookLeadService] Exchange Code Error:', errMsg);
            logFacebookLeadEvent('EXCHANGE_CODE_ERROR', { userId, error: errMsg });
            throw new Error('Failed to exchange authorization code: ' + (errMsg.error?.message || errMsg.message || JSON.stringify(errMsg)));
        }
    }

    async getPermissions(accessToken, userId = 'unknown') {
        console.log('[FacebookLeadService] Getting user permissions...');
        try {
            const url = `https://graph.facebook.com/v20.0/me/permissions`;
            const params = { access_token: accessToken };
            const response = await axios.get(url, { params, timeout: 10000 });
            const permissions = response.data.data;
            logFacebookLeadEvent('GET_PERMISSIONS_SUCCESS', { userId, count: permissions.length });
            return permissions;
        } catch (error) {
            console.error('[FacebookLeadService] Permission check failed:', error.message);
            logFacebookLeadEvent('GET_PERMISSIONS_ERROR', { userId, error: error.message });
            // Don't block flow if check fails, but return empty
            return [];
        }
    }

    async getPages(accessToken, userId = 'unknown') {
        try {
            const url = `https://graph.facebook.com/v20.0/me/accounts`;
            const params = {
                access_token: accessToken,
                fields: 'id,name,access_token,tasks',
                limit: 100
            };

            console.log('[FacebookLeadService] Fetching pages from:', url);
            console.log('[FacebookLeadService] Request params:', { ...params, access_token: '***' });

            const response = await axios.get(url, { params, timeout: 15000 });

            console.log('[FacebookLeadService] Pages API Response:', JSON.stringify(response.data, null, 2));
            console.log('[FacebookLeadService] Pages count:', response.data.data?.length || 0);

            logFacebookLeadEvent('GET_PAGES_SUCCESS', { userId, count: response.data.data.length });
            return response.data.data;
        } catch (error) {
            console.error('[FacebookLeadService] Get Pages Error:', error.response?.data || error.message);
            logFacebookLeadEvent('GET_PAGES_ERROR', { userId, error: error.response?.data || error.message });
            throw new Error('Failed to fetch pages');
        }
    }

    async subscribeApp(pageId, pageAccessToken, userId = 'unknown') {
        try {
            const { appId } = await this.getAppCredentials();

            // Subscribe to 'leadgen' field
            const url = `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`;
            const params = {
                access_token: pageAccessToken,
                subscribed_fields: 'leadgen',
                app_id: appId
            };

            const response = await axios.post(url, null, { params, timeout: 10000 });
            logFacebookLeadEvent('SUBSCRIBE_APP_SUCCESS', { userId, pageId });
            return response.data.success;
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error(`[FacebookLeadService] Subscribe App Error for ${pageId}:`, errMsg);
            logFacebookLeadEvent('SUBSCRIBE_APP_PC_ERROR', { userId, pageId, error: errMsg });
            // Don't throw always, maybe page permissions issue
            return false;
        }
    }

    async savePages(userId, pages) {
        logFacebookLeadEvent('SAVE_PAGES_START', { userId, count: pages ? pages.length : 0 });
        // Upsert pages into DB
        if (!pages || pages.length === 0) return;

        const operations = pages.map(async (page) => {
            // Only save if we have MODERATE or MANAGE permissions? 
            // Usually 'MANAGE' is required for subscribing.
            // For now, save all.

            // Attempt subscribe
            let connected = false;
            try {
                connected = await this.subscribeApp(page.id, page.access_token, userId);
            } catch (e) {
                console.warn('[FacebookLeadService] Auto-subscribe failed', e.message);
                logFacebookLeadEvent('AUTO_SUBSCRIBE_FAIL', { userId, pageId: page.id, error: e.message });
            }

            const { error } = await supabaseAdmin
                .from('integration_facebook_pages')
                .upsert({
                    user_id: userId,
                    page_id: page.id,
                    page_name: page.name,
                    page_access_token: page.access_token,
                    is_connected: connected,
                    updated_at: new Date()
                }, { onConflict: 'user_id, page_id' });

            if (error) {
                console.error('DB Save Error:', error.message);
                logFacebookLeadEvent('SAVE_PAGE_DB_ERROR', { userId, pageId: page.id, error: error.message });
            }
        });

        await Promise.all(operations);
        logFacebookLeadEvent('SAVE_PAGES_COMPLETE', { userId });
    }

    async getUserConnectedStatus(userId) {
        const { data, error } = await supabaseAdmin
            .from('integration_facebook_pages')
            .select('id, page_name, is_connected')
            .eq('user_id', userId)
            .eq('is_connected', true);

        if (error) return { connected: false, pages: [] };
        return {
            connected: data.length > 0,
            pages: data
        };
    }

    async getAllPages(userId) {
        const { data, error } = await supabaseAdmin
            .from('integration_facebook_pages')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;
        return data;
    }

    async togglePageSubscription(userId, pageId, shouldConnect) {
        logFacebookLeadEvent('TOGGLE_SUB_START', { userId, pageId, shouldConnect });
        // 1. Get Page Access Token
        const { data: page, error } = await supabaseAdmin
            .from('integration_facebook_pages')
            .select('page_access_token')
            .eq('user_id', userId)
            .eq('page_id', pageId)
            .single();

        if (error || !page) throw new Error('Page not found');

        let success = false;
        if (shouldConnect) {
            success = await this.subscribeApp(pageId, page.page_access_token, userId);
        } else {
            // Unsubscribe logic (delete subscription)
            try {
                const { appId } = await this.getAppCredentials();
                const url = `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps`;
                const params = {
                    access_token: page.page_access_token,
                    app_id: appId
                };
                await axios.delete(url, { params });
                success = true; // successfully unsubscribed
                logFacebookLeadEvent('UNSUBSCRIBE_APP_SUCCESS', { userId, pageId });
            } catch (error) {
                console.error(`[FacebookLeadService] Unsubscribe App Error for ${pageId}:`, error.response?.data || error.message);
                logFacebookLeadEvent('UNSUBSCRIBE_APP_ERROR', { userId, pageId, error: error.response?.data || error.message });
                // Return false if failed? Or assume success if it was already unsubscribed?
                // If 404/400, maybe it wasn't subscribed. Let's assume false for now if error.
                return false;
            }
        }

        if (success) {
            await supabaseAdmin
                .from('integration_facebook_pages')
                .update({ is_connected: shouldConnect, updated_at: new Date() })
                .eq('user_id', userId)
                .eq('page_id', pageId);
        }

        return success;
    }
    async getLeadForms(userId, pageId) {
        // 1. Get Page Access Token
        const { data: page, error } = await supabaseAdmin
            .from('integration_facebook_pages')
            .select('page_access_token')
            .eq('user_id', userId)
            .eq('page_id', pageId)
            .single();

        if (error || !page) throw new Error('Page not found or access denied');

        try {
            const url = `https://graph.facebook.com/v20.0/${pageId}/leadgen_forms`;
            const params = {
                access_token: page.page_access_token,
                fields: 'id,name,status,leads_count,expired_leads_count',
                limit: 100
            };

            const response = await axios.get(url, { params });
            return response.data.data;
        } catch (error) {
            console.error('[FacebookLeadService] Get Forms Error:', error.response?.data || error.message);
            logFacebookLeadEvent('GET_FORMS_ERROR', { userId, pageId, error: error.response?.data || error.message });
            throw new Error('Failed to fetch lead forms');
        }
    }

    async syncLeads(userId, pageId, formId = null) {
        logFacebookLeadEvent('SYNC_LEADS_START', { userId, pageId, formId });
        // 1. Get Page Access Token
        const { data: page, error } = await supabaseAdmin
            .from('integration_facebook_pages')
            .select('page_access_token')
            .eq('user_id', userId)
            .eq('page_id', pageId)
            .single();

        if (error || !page) throw new Error('Page not found');

        // Logic to fetch leads from graph api /v20.0/{form-id}/leads
        // This is a simplified sync (fetching recent leads)
        // In a real scenario, we might want pagination or time-based filtering.

        try {
            // If formId is provided, sync that form. If not, maybe all? For now, require formId or iterate all.
            // Let's assume formId is required for this action or we fetch all active forms.
            // For the specific UI requirement (Sync button next to form), we likely pass formId.

            if (!formId) throw new Error('Form ID is required for sync');

            const url = `https://graph.facebook.com/v20.0/${formId}/leads`;
            const params = {
                access_token: page.page_access_token,
                limit: 200 // reasonable batch
            };

            const response = await axios.get(url, { params });
            const leads = response.data.data;

            // TODO: Process/Save Leads into 'leads' table in Supabase
            // For now, return the count found to show "Sync Successful: X leads found"

            // This is where you would map Facebook Lead fields to your CRM fields.
            // We will just return the raw data count for now to prove connectivity.

            logFacebookLeadEvent('SYNC_LEADS_SUCCESS', { userId, count: leads.length });

            return { count: leads.length, leads: leads };

        } catch (error) {
            console.error('[FacebookLeadService] Sync Leads Error:', error.response?.data || error.message);
            logFacebookLeadEvent('SYNC_LEADS_ERROR', { userId, pageId, formId, error: error.response?.data || error.message });
            throw new Error('Failed to sync leads');
        }
    }
}

module.exports = new FacebookLeadService();
