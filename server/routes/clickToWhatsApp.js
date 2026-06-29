const express = require('express');
const router = express.Router();
const FacebookAdsService = require('../services/facebookAdsService');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
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

        // Fetch both pages and ad accounts in parallel
        const [adAccounts, pages] = await Promise.all([
            FacebookAdsService.fetchAdAccounts(accessToken),
            FacebookAdsService.fetchPages(accessToken)
        ]);

        res.status(200).json({
            success: true,
            data: {
                adAccounts,
                pages
            }
        });
    } catch (error) {
        console.error('[Fetch Accounts API Error]:', error);
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
        const { accessToken } = req.body;

        if (!accessToken) {
            return res.status(400).json({ error: 'Access token is required.' });
        }

        // Fetch system settings to get app credentials for token exchange
        const { data: sysSettings } = await supabase
            .from('system_settings')
            .select('embedded_app_id, embedded_app_secret')
            .single();

        let finalToken = accessToken;

        if (sysSettings && sysSettings.embedded_app_id && sysSettings.embedded_app_secret) {
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

        // Save to whatsapp_config (upsert)
        const { error: upsertError } = await supabase
            .from('whatsapp_config')
            .upsert({
                user_id: userId,
                meta_access_token: finalToken,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

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
