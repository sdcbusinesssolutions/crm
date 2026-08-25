const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifySuperAdmin } = require('../../middleware/admin/authMiddleware');

router.use(verifySuperAdmin);

// GET all global default video guides
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('video_guides')
            .select('*')
            .eq('domain', 'global')
            .order('module_name', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching super admin video guides:', err);
        res.status(500).json({ error: 'Failed to fetch video guides' });
    }
});

// POST create or update a global default video guide
router.post('/', async (req, res) => {
    try {
        const { module_name, video_url } = req.body;
        if (!module_name || video_url === undefined) {
            return res.status(400).json({ error: 'module_name and video_url are required' });
        }

        // Upsert since (module_name, domain) is unique
        const { data, error } = await supabaseAdmin
            .from('video_guides')
            .upsert({
                module_name,
                video_url,
                domain: 'global'
            }, { onConflict: 'module_name,domain' })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error saving super admin video guide:', err);
        res.status(500).json({ error: 'Failed to save video guide' });
    }
});

// DELETE a global default video guide
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('video_guides')
            .delete()
            .eq('id', id)
            .eq('domain', 'global');

        if (error) throw error;
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting super admin video guide:', err);
        res.status(500).json({ error: 'Failed to delete video guide' });
    }
});

module.exports = router;
