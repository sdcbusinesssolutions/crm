const express = require('express');
const router = express.Router();
const FacebookAdsService = require('../services/facebookAdsService');
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

const getUserId = (req) => req.user.id;

/**
 * GET /api/click-to-whatsapp/accounts
 * Fetches the user's connected Ad Accounts and Facebook Pages
 */
router.get('/accounts', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        // Fetch User's Meta Access Token from WhatsApp Config
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !config || !config.meta_access_token) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = config.meta_access_token;

        let adAccounts = [];
        let pages = [];
        try {
            adAccounts = await FacebookAdsService.fetchAdAccounts(accessToken);
        } catch (e) {
            console.error('[Fetch Ad Accounts API Error]:', e.message);
            return res.status(400).json({ error: 'Ad Accounts Error: ' + e.message });
        }

        try {
            pages = await FacebookAdsService.fetchPages(accessToken);
        } catch (e) {
            console.error('[Fetch Pages API Error]:', e.message);
            return res.status(400).json({ error: 'Pages Error: ' + e.message });
        }

        res.status(200).json({
            success: true,
            data: {
                adAccounts,
                pages
            }
        });
    } catch (error) {
        console.error('[Fetch Accounts Unexpected Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while fetching accounts.' });
    }
});

/**
 * GET /api/click-to-whatsapp/insights/:level/:id
 * Fetches analytics for a specific campaign, adset, or ad
 */
router.get('/insights/:level/:id', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { level, id } = req.params;

        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !config || !config.meta_access_token) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const insights = await FacebookAdsService.fetchInsights(config.meta_access_token, id, level);

        res.status(200).json({
            success: true,
            data: insights
        });
    } catch (error) {
        console.error('[Fetch Insights API Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while fetching insights.' });
    }
});

/**
 * POST /api/click-to-whatsapp/launch
 * Launches a new Click to WhatsApp Ad Campaign
 */
router.post('/launch', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);

        const {
            adAccountId,
            pageId,
            campaignName,
            dailyBudget,
            headline,
            primaryText,
            imageUrl,
            targetCountries,
            minAge,
            maxAge,
            gender,
            startDate,
            endDate,
            welcomeMessageText,
            iceBreakerText
        } = req.body;

        // Validation
        if (!adAccountId || !pageId || !campaignName || !dailyBudget || !headline || !primaryText || !imageUrl || !targetCountries || !minAge || !maxAge) {
            return res.status(400).json({ error: 'Missing required ad configuration parameters.' });
        }

        // Fetch User's Meta Access Token from WhatsApp Config
        // This makes it work dynamically for any user similar to embedded signup
        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        if (error || !config || !config.meta_access_token) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = config.meta_access_token;

        // Launch Ad via Service
        const result = await FacebookAdsService.launchAd({
            accessToken,
            adAccountId,
            pageId,
            campaignName,
            dailyBudget,
            headline,
            primaryText,
            imageUrl,
            targetCountries,
            minAge,
            maxAge,
            gender,
            startDate,
            endDate,
            welcomeMessageText,
            iceBreakerText
        });

        res.status(200).json(result);
    } catch (error) {
        console.error('[Click To WhatsApp API Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while launching the ad.' });
    }
});

/**
 * POST /api/click-to-whatsapp/auth
 * Handles saving the Facebook Access Token from frontend login
 */
router.post('/auth', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { accessToken, code } = req.body;

        if (!accessToken && !code) {
            return res.status(400).json({ error: 'Access token or code is required.' });
        }

        const targetDomain = req.get('host') ? req.get('host').split(':')[0] : 'cloudospire.in';
        const metaService = require('../services/MetaOnboardingService');
        
        let sysSettings = null;
        try {
            sysSettings = await metaService.getSystemSettings(targetDomain);
        } catch (e) {
            console.error('Failed to get system settings:', e);
        }

        let finalToken = accessToken;

        if (code && sysSettings && sysSettings.embedded_app_id && sysSettings.embedded_app_secret) {
            try {
                const axios = require('axios');
                const response = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
                    params: {
                        client_id: sysSettings.embedded_app_id,
                        client_secret: sysSettings.embedded_app_secret,
                        code: code
                    }
                });
                if (response.data && response.data.access_token) {
                    finalToken = response.data.access_token;
                }
            } catch (exchangeError) {
                console.error('[Code Exchange Error]:', exchangeError.response?.data || exchangeError.message);
                return res.status(400).json({ error: 'Failed to exchange code for token' });
            }
        } else if (accessToken && sysSettings && sysSettings.embedded_app_id && sysSettings.embedded_app_secret) {
            try {
                const axios = require('axios');
                const response = await axios.get('https://graph.facebook.com/v20.0/oauth/access_token', {
                    params: {
                        grant_type: 'fb_exchange_token',
                        client_id: sysSettings.embedded_app_id,
                        client_secret: sysSettings.embedded_app_secret,
                        fb_exchange_token: accessToken
                    }
                });
                if (response.data && response.data.access_token) {
                    finalToken = response.data.access_token;
                }
            } catch (exchangeError) {
                console.error('[Token Exchange Error]:', exchangeError.response?.data || exchangeError.message);
                // Fall back to short-lived token if exchange fails
            }
        }

        if (!finalToken) {
            return res.status(400).json({ error: 'Valid token could not be obtained.' });
        }

        // Save to whatsapp_config (update first existing, or insert new)
        const { data: existingConfigs } = await supabase
            .from('whatsapp_config')
            .select('id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        let upsertError = null;
        if (existingConfigs && existingConfigs.length > 0) {
            const { error } = await supabase
                .from('whatsapp_config')
                .update({ meta_access_token: finalToken, updated_at: new Date().toISOString() })
                .eq('user_id', userId); // Update all accounts for this user to have the new token
            upsertError = error;
        } else {
            const { error } = await supabase
                .from('whatsapp_config')
                .insert({
                    user_id: userId,
                    name: 'Facebook Ads Config',
                    meta_access_token: finalToken,
                    updated_at: new Date().toISOString()
                });
            upsertError = error;
        }

        if (upsertError) {
            throw upsertError;
        }

        res.status(200).json({ success: true, message: 'Facebook account connected successfully.' });
    } catch (error) {
        console.error('[Click To WhatsApp Auth Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while connecting Facebook account.' });
    }
});

module.exports = router;
