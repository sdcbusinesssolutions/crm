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

module.exports = router;
