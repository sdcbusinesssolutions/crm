const express = require('express');
const router = express.Router();
const FacebookAdsService = require('../services/facebookAdsService');
const CampaignAIService = require('../services/CampaignAIService');
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const logger = require('../utils/logger');

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
            .select('meta_access_token, phone_number, phone_number_id')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = envToken || config.meta_access_token;

        let adAccounts = [];
        let pages = [];
        let apiErrors = [];
        try {
            adAccounts = await FacebookAdsService.fetchAdAccounts(accessToken);
        } catch (e) {
            console.error('[Fetch Ad Accounts API Error]:', e.message);
            apiErrors.push('Ad Accounts Error: ' + e.message);
        }

        try {
            pages = await FacebookAdsService.fetchPages(accessToken);
        } catch (e) {
            console.error('[Fetch Pages API Error]:', e.message);
            apiErrors.push('Pages Error: ' + e.message);
        }

        res.status(200).json({
            success: true,
            data: {
                adAccounts,
                pages,
                whatsappConfig: {
                    phone_number: config?.phone_number || '',
                    phone_number_id: config?.phone_number_id || ''
                }
            }
        });
    } catch (error) {
        console.error('[Fetch Accounts Unexpected Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while fetching accounts.' });
    }
});

/**
 * GET /api/click-to-whatsapp/analytics/:accountId
 * Fetches the Analytics Dashboard data for a given ad account
 */
router.get('/analytics/:accountId', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { accountId } = req.params;

        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const accessToken = envToken || config.meta_access_token;
        const datePreset = req.query.datePreset || 'last_7d';
        const since = req.query.since;
        const until = req.query.until;
        const dashboardData = await FacebookAdsService.getAnalyticsDashboard(accessToken, accountId, datePreset, since, until);

        res.status(200).json({
            success: true,
            data: dashboardData
        });
    } catch (error) {
        console.error('[Fetch Analytics Dashboard Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while fetching analytics.' });
    }
});

/**
 * GET /api/click-to-whatsapp/search-targeting
 * Search Meta API for detailed targeting (interests, behaviors)
 */
router.get('/search-targeting', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { type, q, adAccountId, country } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'q is required' });
        }

        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;
        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const accessToken = envToken || config.meta_access_token;
        const axios = require('axios');
        
        let searchData = [];
        let fallbackTriggered = false;
        
        try {
            if (adAccountId) {
                const searchRes = await axios.get(`https://graph.facebook.com/v20.0/act_${adAccountId}/targetingsearch`, {
                    params: { q, country: country || 'IN', access_token: accessToken, limit: 30 }
                });
                
                searchData = searchRes.data.data || [];
                
                if (type === 'adbehavior') {
                    searchData = searchData.filter(item => item.type && item.type.toLowerCase().includes('behavior'));
                } else if (type === 'adinterest') {
                    searchData = searchData.filter(item => item.type && item.type.toLowerCase().includes('interest'));
                }
            } else {
                fallbackTriggered = true;
            }
        } catch (e) {
            const errorCode = e.response?.data?.error?.code;
            if (errorCode === 200 || errorCode === 10 || errorCode === 190) {
                console.warn('[Search Targeting] Primary search failed with permission/token error, using fallback:', errorCode);
                fallbackTriggered = true;
            } else {
                // If it's a different error, throw it so it surfaces properly
                throw e;
            }
        }

        if (fallbackTriggered || searchData.length === 0) {
            const fallbackType = type === 'adbehavior' ? 'adinterest' : (type || 'adinterest');
            try {
                const fallbackRes = await axios.get(`https://graph.facebook.com/v20.0/search`, {
                    params: { type: fallbackType, q, access_token: accessToken, limit: 30 }
                });
                // When falling back because of an error, just populate whatever it found
                if (fallbackTriggered) {
                    searchData = fallbackRes.data.data || [];
                } else if (searchData.length === 0) {
                    // if it didn't error but just found 0 results, we also fallback just in case
                    searchData = fallbackRes.data.data || [];
                }
            } catch (fallbackError) {
                console.error('[Search Targeting] Fallback search failed:', fallbackError.response?.data || fallbackError.message);
                if (fallbackTriggered) {
                    throw fallbackError; // throw it if we relied on the fallback
                }
            }
        }

        res.status(200).json({ success: true, data: searchData });
    } catch (error) {
        console.error('[Search Targeting API Error]:', error.response?.data || error.message);
        res.status(500).json({ error: error.message || 'An error occurred while searching targeting.' });
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

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const accessToken = envToken || config.meta_access_token;

        const timeIncrement = req.query.timeIncrement;
        const datePreset = req.query.datePreset || 'last_30d';
        const since = req.query.since;
        const until = req.query.until;
        const fields = req.query.fields;
        
        let breakdowns = null;
        if (req.query.breakdowns) {
            try {
                breakdowns = JSON.parse(req.query.breakdowns);
            } catch (e) {
                // If it's not valid JSON, assume it's a comma separated string
                breakdowns = req.query.breakdowns.split(',');
            }
        }

        const insights = await FacebookAdsService.fetchInsights(accessToken, id, level, timeIncrement, datePreset, breakdowns, since, until, fields);

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
 * POST /api/click-to-whatsapp/toggle-status
 * Toggles the status of a Meta Ads Object (Campaign, AdSet, Ad)
 */
router.post('/toggle-status', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const supabase = getAuthenticatedSupabase(req);
        const { objectId, status } = req.body;

        if (!objectId || !status) {
            return res.status(400).json({ error: 'objectId and status are required' });
        }

        const { data: config, error } = await supabase
            .from('whatsapp_config')
            .select('meta_access_token')
            .eq('user_id', userId)
            .single();

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ error: 'Meta Access Token not found.' });
        }

        const accessToken = envToken || config.meta_access_token;
        const result = await FacebookAdsService.toggleStatus(accessToken, objectId, status);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('[Toggle Status API Error]:', error);
        res.status(500).json({ error: error.message || 'An error occurred while toggling status.' });
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
            mediaType,
            targetCountries,
            minAge,
            maxAge,
            gender,
            startDate,
            endDate,
            welcomeMessageText,
            iceBreakerText,
            description,
            status,
            objective,
            optimizationGoal,
            whatsappNumber,
            geoLocations,
            excludedGeoLocations,
            radius,
            advantageAudience,
            flexibleSpec,
            exclusions,
            duplicates,
            advantagePlacements,
            publisherPlatforms
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

        const envToken = process.env.META_ACCESS_TOKEN;

        if (!envToken && (error || !config || !config.meta_access_token)) {
            return res.status(403).json({ 
                error: 'Meta Access Token not found. Please complete the WhatsApp Embedded Signup first.' 
            });
        }

        const accessToken = envToken || config.meta_access_token;

        // Launch Ad via Service (now using Bulk mode)
        const result = await FacebookAdsService.createBulkCampaign(accessToken, adAccountId, {
            pageId,
            campaignName,
            dailyBudget,
            headline,
            primaryText,
            imageUrl,
            mediaType,
            targetCountries,
            minAge,
            maxAge,
            gender,
            startDate,
            endDate,
            welcomeMessageText,
            iceBreakerText,
            description,
            status,
            objective,
            optimizationGoal,
            whatsappNumber,
            geoLocations,
            excludedGeoLocations,
            radius,
            advantageAudience,
            flexibleSpec,
            exclusions,
            advantagePlacements,
            publisherPlatforms
        }, duplicates);

        res.status(200).json(result);
    } catch (error) {
        console.error('[Click To WhatsApp API Error]:', error.message ? error.message : JSON.stringify(error, null, 2));
        logger.logMetaEvent('CLICK_TO_WHATSAPP_CREATE_CAMPAIGN_ERROR', {
            message: error.message || 'Unknown Error',
            stack: error.stack,
            error_details: error.response?.data || null
        });
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

/**
 * POST /api/click-to-whatsapp/generate-bulk-ai
 * Generates bulk adset variations using AI (ChatGPT/OpenRouter/Gemini)
 */
router.post('/generate-bulk-ai', requireAuth, async (req, res) => {
    try {
        const userId = getUserId(req);
        const { baseConfig, prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        const adSets = await CampaignAIService.generateBulkRows(userId, baseConfig, prompt);

        res.status(200).json({ success: true, data: adSets });
    } catch (error) {
        console.error('[Generate Bulk AI Error]:', error);
        res.status(500).json({ error: error.message || 'Failed to generate variations using AI.' });
    }
});

module.exports = router;
