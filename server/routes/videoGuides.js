const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// GET video guide for a specific module
router.get('/:moduleName', async (req, res) => {
    try {
        const { moduleName } = req.params;
        const userId = req.user.id;

        // Fetch user domain
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('id', userId)
            .single();

        const domain = profile?.signup_domain;

        // First, check the global guide status
        const { data: globalGuide } = await supabaseAdmin
            .from('video_guides')
            .select('video_url, is_active')
            .eq('module_name', moduleName)
            .eq('domain', 'global')
            .single();

        // If the global guide doesn't exist or is toggled off, no video is shown
        if (!globalGuide || globalGuide.is_active === false) {
            return res.json({ video_url: null });
        }

        // Try to get the tenant override first
        if (domain) {
            const { data: override } = await supabaseAdmin
                .from('video_guides')
                .select('video_url')
                .eq('module_name', moduleName)
                .eq('domain', domain)
                .single();

            if (override) {
                return res.json({ video_url: override.video_url });
            }
        }

        // Fallback to global
        return res.json({ video_url: globalGuide.video_url });

        // No video found
        res.json({ video_url: null });
    } catch (err) {
        console.error('Error fetching video guide:', err);
        res.status(500).json({ error: 'Failed to fetch video guide' });
    }
});

module.exports = router;
