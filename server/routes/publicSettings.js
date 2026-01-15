const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabase } = require('../lib/supabaseClient');

// Use the shared client which is already initialized with SUPABASE_URL and KEY
// If that exports 'supabase' as the anon client, use it.
const publicSupabase = supabase;

// GET /api/public-settings?domain=example.com
router.get('/', async (req, res) => {
    try {
        const { domain } = req.query;
        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        // Fetch settings
        const { data, error } = await publicSupabase
            .from('domain_settings')
            .select('*')
            .eq('domain', domain)
            .single();

        if (error || !data) {
            // Return defaults if not found
            return res.json({
                brand_name: 'App',
                primary_color: '#2563eb', // Default Blue
                logo_url: null
            });
        }

        res.json(data);
    } catch (err) {
        console.error('Error fetching public settings:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

module.exports = router;
