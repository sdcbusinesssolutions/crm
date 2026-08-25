const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

router.use(verifyAdminToken);

// GET merged list of global guides + tenant overrides
router.get('/', async (req, res) => {
    try {
        const domain = req.admin.managed_domain || req.admin.domain;
        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        // Fetch all global guides
        const { data: globalGuides, error: globalError } = await supabaseAdmin
            .from('video_guides')
            .select('*')
            .eq('domain', 'global');
        if (globalError) throw globalError;

        // Fetch tenant overrides
        const { data: tenantOverrides, error: tenantError } = await supabaseAdmin
            .from('video_guides')
            .select('*')
            .eq('domain', domain);
        if (tenantError) throw tenantError;

        // Merge them. Overrides replace global guides in the response format.
        const merged = globalGuides.map(globalGuide => {
            const override = tenantOverrides.find(o => o.module_name === globalGuide.module_name);
            return {
                id: override ? override.id : globalGuide.id,
                module_name: globalGuide.module_name,
                global_video_url: globalGuide.video_url,
                override_video_url: override ? override.video_url : null,
                has_override: !!override
            };
        });

        res.json(merged);
    } catch (err) {
        console.error('Error fetching tenant video guides:', err);
        res.status(500).json({ error: 'Failed to fetch video guides' });
    }
});

// POST save a tenant override
router.post('/', async (req, res) => {
    try {
        const domain = req.admin.managed_domain || req.admin.domain;
        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        const { module_name, video_url } = req.body;
        if (!module_name || !video_url) {
            return res.status(400).json({ error: 'module_name and video_url are required' });
        }

        // Upsert override for this domain
        const { data, error } = await supabaseAdmin
            .from('video_guides')
            .upsert({
                module_name,
                video_url,
                domain: domain
            }, { onConflict: 'module_name,domain' })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error saving tenant video guide override:', err);
        res.status(500).json({ error: 'Failed to save video guide override' });
    }
});

// DELETE a tenant override (reverting to global)
router.delete('/:module_name', async (req, res) => {
    try {
        const domain = req.admin.managed_domain || req.admin.domain;
        const { module_name } = req.params;

        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        const { error } = await supabaseAdmin
            .from('video_guides')
            .delete()
            .eq('module_name', module_name)
            .eq('domain', domain);

        if (error) throw error;
        res.json({ message: 'Override removed successfully' });
    } catch (err) {
        console.error('Error deleting tenant video guide override:', err);
        res.status(500).json({ error: 'Failed to remove override' });
    }
});

module.exports = router;
