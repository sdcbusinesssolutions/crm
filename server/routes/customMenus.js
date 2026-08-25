const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');

// Apply auth middleware to all routes
router.use(requireAuth);

// GET all custom menus for the user and global ones for their domain
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch user domain
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('id', userId)
            .single();
            
        const domain = profile?.signup_domain;

        let query = supabaseAdmin
            .from('custom_menus')
            .select('*');
            
        if (domain) {
            query = query.or(`user_id.eq.${userId},and(domain.eq.${domain},is_global.eq.true)`);
        } else {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching custom menus:', err);
        res.status(500).json({ error: 'Failed to fetch custom menus' });
    }
});

// POST a new custom menu
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, type, value } = req.body;

        if (!name || !value) {
            return res.status(400).json({ error: 'Name and Value are required' });
        }

        const { data, error } = await supabaseAdmin
            .from('custom_menus')
            .insert([{
                user_id: userId,
                name,
                type: type || 'URL',
                value
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        console.error('Error creating custom menu:', err);
        res.status(500).json({ error: 'Failed to create custom menu' });
    }
});

// DELETE a custom menu
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const { error } = await supabaseAdmin
            .from('custom_menus')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw error;
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        console.error('Error deleting custom menu:', err);
        res.status(500).json({ error: 'Failed to delete custom menu' });
    }
});

module.exports = router;
