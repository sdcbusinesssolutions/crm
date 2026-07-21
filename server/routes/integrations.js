const express = require('express');
const router = express.Router();
const facebookService = require('../services/FacebookLeadService');
const { supabaseAdmin } = require('../lib/supabaseClient');
const { logFacebookLeadEvent } = require('../utils/logger');
const { requirePermission, ACCESS_TYPES } = require('../middleware/requirePermission');



// ...
// ...
router.get('/facebook/pages', requirePermission('Integrations', ACCESS_TYPES.READ), async (req, res) => {
    try {
        const userId = req.user.id;
        const pages = await facebookService.getAllPages(userId);
        res.json(pages);
    } catch (error) {
        console.error('Failed to fetch pages:', error);
        res.status(500).json({ error: 'Failed to fetch pages' });
    }
});

router.get('/facebook/pages/:pageId/forms', requirePermission('Integrations', ACCESS_TYPES.READ), async (req, res) => {
    try {
        const userId = req.user.id;
        const { pageId } = req.params;
        const forms = await facebookService.getLeadForms(userId, pageId);
        res.json(forms);
    } catch (error) {
        console.error('Failed to fetch forms:', error);
        res.status(500).json({ error: 'Failed to fetch forms' });
    }
});

router.post('/facebook/leads/sync', requirePermission('Integrations', ACCESS_TYPES.READ_WRITE), async (req, res) => {
    try {
        const userId = req.user.id;
        const { pageId, formId } = req.body;
        const result = await facebookService.syncLeads(userId, pageId, formId);
        res.json(result);
    } catch (error) {
        console.error('Sync Leads Failed:', error);
        res.status(500).json({ error: error.message || 'Failed to sync leads' });
    }
});

router.get('/facebook/config', requirePermission('Integrations', ACCESS_TYPES.READ), async (req, res) => {
    try {
        const { appId, configId } = await facebookService.getAppCredentials();

        if (!appId) {
            return res.status(500).json({ error: 'Facebook App ID not configured on server (Check .env or System Settings)' });
        }
        res.json({ appId, configId });
    } catch (error) {
        console.error('Failed to get Facebook Config:', error);
        res.status(500).json({ error: 'Internal server error fetching configuration' });
    }
});

router.get('/facebook/status', requirePermission('Integrations', ACCESS_TYPES.READ), async (req, res) => {
    // ...
    try {
        const userId = req.user.id;
        const status = await facebookService.getUserConnectedStatus(userId);
        res.json(status);
    } catch (error) {
        console.error('Status Check Failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/facebook/connect', requirePermission('Integrations', ACCESS_TYPES.READ_WRITE), async (req, res) => {
    try {
        const { access_token } = req.body;
        const userId = req.user.id;

        console.log(`[Facebook Connect] Request received for User ${userId}`);
        console.log('[Facebook Connect] Request Body:', JSON.stringify(req.body, null, 2));

        if (!access_token && !req.body.code) {
            console.error('[Facebook Connect] Partial Failure: No access_token or code provided in body');
            return res.status(400).json({ error: 'Access token or code required' });
        }

        // 1. Exchange Token
        let longLivedToken = access_token;
        try {
            if (req.body.code) {
                console.log('[Facebook Connect] Exchanging authorization code...');
                longLivedToken = await facebookService.exchangeCodeForToken(req.body.code, userId);
            } else {
                console.log('[Facebook Connect] Exchanging short-lived token...');
                longLivedToken = await facebookService.exchangeToken(access_token, userId);
            }
            console.log('[Facebook Connect] Token exchanged successfully');
        } catch (e) {
            console.warn('[Facebook Connect] Token exchange warning:', e.message);
            // If exchange fails, we can't proceed.
            return res.status(400).json({ error: 'Token exchange failed: ' + e.message });
        }

        // 1.5 Verify Permissions (The "Check")
        console.log('[Facebook Connect] Verifying permissions...');
        const permissions = await facebookService.getPermissions(longLivedToken, userId);
        console.log('[Facebook Connect] Permissions received:', JSON.stringify(permissions, null, 2));

        const hasLeadsPermission = permissions.some(p => p.permission === 'leads_retrieval' && p.status === 'granted');
        const hasPagesPermission = permissions.some(p => p.permission === 'pages_show_list' && p.status === 'granted');
        // Check for pages_manage_ads or similar if strict adherence is needed
        const hasAdsPermission = permissions.some(p => (p.permission === 'pages_manage_ads' || p.permission === 'ads_management') && p.status === 'granted');

        console.log('[Facebook Connect] Permission check results:', {
            leads_retrieval: hasLeadsPermission,
            pages_show_list: hasPagesPermission,
            pages_manage_ads: hasAdsPermission
        });

        if (!hasLeadsPermission || !hasPagesPermission || !hasAdsPermission) {
            const missing = {
                leads_retrieval: !hasLeadsPermission,
                pages_show_list: !hasPagesPermission,
                pages_manage_ads: !hasAdsPermission
            };
            console.warn('[Facebook Connect] WARNING: Critical permissions missing:', missing);
            logFacebookLeadEvent('CONNECT_PERMISSIONS_WARNING', { userId, missing });

            // Should we block? If pages_show_list is missing, we definitely can't find pages.
            // User Request: Force allow connection even if permissions appear missing, because Config ID might behave differently.
            if (!hasPagesPermission) {
                console.warn('[Facebook Connect] proceeding despite missing pages_show_list...');
                // return res.status(403).json({
                //    error: 'Missing "pages_show_list" permission. Please reconnect and ensure you select ALL pages.',
                //    missing
                // });
            }
        }

        // 2. Fetch Pages
        console.log('[Facebook Connect] Fetching pages...');
        const pages = await facebookService.getPages(longLivedToken, userId);
        console.log(`[Facebook Connect] Fetched ${pages.length} pages`);

        if (pages.length === 0) {
            console.warn('[Facebook Connect] No pages found. This is likely due to permissions filtering (Graph API requires Manage/Show List to see them).');
        }

        // 3. Save & Subscribe
        console.log('[Facebook Connect] Saving pages...');
        await facebookService.savePages(userId, pages);
        console.log('[Facebook Connect] Pages saved.');

        // 4. Return success
        res.json({ success: true, count: pages.length });

    } catch (error) {
        console.error('[Facebook Connect] Fatal Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});





router.post('/facebook/pages/:pageId/toggle', requirePermission('Integrations', ACCESS_TYPES.READ_WRITE), async (req, res) => {
    try {
        const userId = req.user.id;
        const { pageId } = req.params;
        const { connect } = req.body; // boolean

        const success = await facebookService.togglePageSubscription(userId, pageId, connect);
        if (success) {
            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Failed to toggle subscription' });
        }
    } catch (error) {
        console.error('Toggle Page Error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
    }
});

router.post('/facebook/subscribe', async (req, res) => {
    // Optional endpoint if we want manual subscription per page later
    res.sendStatus(501);
});


// --- Google Integration ---
const googleRoutes = require('./integrations/google');
router.use('/google', requirePermission('Integrations', ACCESS_TYPES.READ), googleRoutes);

// --- Gmail Integration ---
const gmailRoutes = require('./integrations/gmail');
router.use('/gmail', requirePermission('Integrations', ACCESS_TYPES.READ), gmailRoutes);

// --- Google Calendar Integration ---
const calendarRoutes = require('./integrations/calendar');
router.use('/calendar', requirePermission('Integrations', ACCESS_TYPES.READ), calendarRoutes);

// --- Google Contacts Integration ---
const contactsRoutes = require('./integrations/contacts');
router.use('/contacts', requirePermission('Integrations', ACCESS_TYPES.READ), contactsRoutes);

// --- SMTP Integration ---
const smtpRoutes = require('./integrations/smtp');
router.use('/smtp', requirePermission('Integrations', ACCESS_TYPES.READ), smtpRoutes);

// --- OpenAI Integration ---
const openaiRoutes = require('./integrations/openai');
router.use('/openai', requirePermission('Integrations', ACCESS_TYPES.READ), openaiRoutes);

// --- Callyzer Integration ---
const callyzerRoutes = require('./integrations/callyzer');
router.use('/callyzer', requirePermission('Integrations', ACCESS_TYPES.READ), callyzerRoutes);

module.exports = router;
