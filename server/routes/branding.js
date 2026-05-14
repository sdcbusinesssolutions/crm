const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { supabaseAdmin, supabase } = require('../lib/supabaseClient');

// Soft Auth Middleware
// Attempts to identify user but does not block request if failed
const softAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            
            // 1. Try local Staff JWT first (Fast)
            try {
                const decoded = jwt.verify(token, (process.env.JWT_SECRET || 'your-secret-key').trim());
                if (decoded && decoded.tenantId) {
                    req.user = { 
                        id: decoded.tenantId, 
                        isStaff: true 
                    };
                    return next();
                }
            } catch (jwtErr) {
                // Not a staff token, ignore and try Supabase
            }

            // 2. Try Supabase Auth
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
        
        // Use supabaseAdmin to bypass RLS for branding fetch (Owners/Staff need this)
        const { data, error } = await supabaseAdmin
            .from('branding_settings')
            .select('theme_config')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) {
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
