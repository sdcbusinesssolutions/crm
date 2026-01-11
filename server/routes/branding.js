const express = require('express');
const router = express.Router();
const { supabase, getAuthenticatedSupabase } = require('../lib/supabaseClient');

// Soft Auth Middleware
// Attempts to identify user but does not block request if failed
const softAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            // Use static client to verify token
            const { data } = await supabase.auth.getUser(token);
            if (data?.user) {
                req.user = data.user;
            }
        }
    } catch (e) {
        // Ignore auth errors
        console.warn('Soft Auth Check Failed:', e.message);
    }
    next();
};

// GET /api/settings/branding
// Returns theme config for logged-in user, or null (default) for guests/invalid tokens
router.get('/', softAuth, async (req, res) => {
    try {
        // If not authenticated, return null immediately (Frontend will use default theme)
        if (!req.user) {
            return res.json(null);
        }

        const userId = req.user.id;
        const authClient = getAuthenticatedSupabase(req);

        const { data, error } = await authClient
            .from('branding_settings')
            .select('theme_config')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Branding fetch error:', error.message);
        }

        res.json(data ? data.theme_config : null);
    } catch (error) {
        // Fail gracefully to default theme
        console.error('Branding endpoint error:', error.message);
        res.json(null);
    }
});

module.exports = router;
