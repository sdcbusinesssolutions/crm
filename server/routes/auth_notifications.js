const express = require('express');
const router = express.Router();
const notificationEngine = require('../services/notificationEngine');
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');

// Endpoint triggered after successful signup
router.post('/trigger-signup-notifications', async (req, res) => {
    try {
        const { email, name, contact_number, domain } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        // Pass off to our dedicated engine
        const result = await notificationEngine.processSignupNotifications(domain, { email, name, contact_number });
        
        return res.json(result);

    } catch (error) {
        console.error('Error in trigger-signup-notifications:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /settings
router.get('/settings', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const meta = user.user_metadata || {};
        const notificationSettings = meta.notificationSettings || {};
        
        return res.json(notificationSettings);
    } catch (err) {
        console.error('Error fetching auth notification settings:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// POST /settings
router.post('/settings', async (req, res) => {
    try {
        const { domain, ...updates } = req.body;
        
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        const meta = user.user_metadata || {};
        const newSettings = { ...(meta.notificationSettings || {}), ...updates };
        
        // Update user metadata via auth admin api
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: { notificationSettings: newSettings }
        });

        return res.json({ success: true });
    } catch (err) {
        console.error('Error saving auth notification settings:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
