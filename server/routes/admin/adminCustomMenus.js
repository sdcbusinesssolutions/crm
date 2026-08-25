const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');
const { verifyAdminToken } = require('../../middleware/admin/authMiddleware');

// Apply admin auth middleware to all routes
router.use(verifyAdminToken);

// GET all global custom menus for the admin's managed domain
router.get('/', async (req, res) => {
    try {
        const domain = req.admin.managed_domain;
        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        const { data, error } = await supabaseAdmin
            .from('custom_menus')
            .select('*')
            .eq('domain', domain)
            .eq('is_global', true)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching global custom menus:', err);
        res.status(500).json({ error: 'Failed to fetch custom menus' });
    }
});

// POST a new global custom menu
router.post('/', async (req, res) => {
    try {
        // We use admin's user id, or a dummy id if auth.users requires a valid UUID
        // Assuming admin's user object has id
        const userId = req.admin.id;
        const domain = req.admin.managed_domain;
        const { name, type, value } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        if (!name || !value) {
            return res.status(400).json({ error: 'Name and Value are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('custom_menus')
            .insert([{
                user_id: userId, // Keep as required by schema (usually auth.users foreign key)
                domain: domain,
                is_global: true,
                name,
                type: type || 'URL',
                value
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error creating global custom menu:', err);
        res.status(500).json({ error: 'Failed to create custom menu' });
    }
});

// DELETE a global custom menu
router.delete('/:id', async (req, res) => {
    try {
        const domain = req.admin.managed_domain;
        const { id } = req.params;

        if (!domain) {
            return res.status(400).json({ error: 'Admin domain not found' });
        }

        // Only allow deleting global menus from the admin's own domain
        const { error } = await supabaseAdmin
            .from('custom_menus')
            .delete()
            .eq('id', id)
            .eq('domain', domain)
            .eq('is_global', true);

        if (error) throw error;
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting global custom menu:', err);
        res.status(500).json({ error: 'Failed to delete custom menu' });
    }
});

module.exports = router;
