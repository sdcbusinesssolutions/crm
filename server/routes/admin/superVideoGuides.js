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
        const { module_name, video_url, is_active } = req.body;
        if (!module_name || video_url === undefined) {
            return res.status(400).json({ error: 'module_name and video_url are required' });
        }

        // Upsert since (module_name, domain) is unique
        const { data, error } = await supabaseAdmin
            .from('video_guides')
            .upsert({
                module_name,
                video_url,
                is_active: is_active !== undefined ? is_active : true,
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

// Toggle a global default video guide
router.put('/:id/toggle', async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (is_active === undefined) {
            return res.status(400).json({ error: 'is_active is required' });
        }

        const { data, error } = await supabaseAdmin
            .from('video_guides')
            .update({ is_active })
            .eq('id', id)
            .eq('domain', 'global')
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error toggling super admin video guide:', err);
        res.status(500).json({ error: 'Failed to toggle video guide' });
    }
});

// DELETE a global default video guide
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // 1. Get the module_name for this global guide
        const { data: guide, error: fetchError } = await supabaseAdmin
            .from('video_guides')
            .select('module_name')
            .eq('id', id)
            .eq('domain', 'global')
            .single();
            
        if (fetchError) throw fetchError;
        
        // 2. Delete ALL guides (global and tenant overrides) with this module_name
        if (guide && guide.module_name) {
            const { error: deleteError } = await supabaseAdmin
                .from('video_guides')
                .delete()
                .eq('module_name', guide.module_name);
                
            if (deleteError) throw deleteError;
        }

        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting super admin video guide:', err);
        res.status(500).json({ error: 'Failed to delete video guide' });
    }
});

module.exports = router;
