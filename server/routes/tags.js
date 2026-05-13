const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// GET /api/tags - Get all unique tags for the authenticated user
router.get('/', requirePermission('Tags', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch all contacts for the user
        const { data: contacts, error } = await supabase
            .from('contacts')
            .select('tags')
            .eq('user_id', user.id);

        if (error) throw error;

        // Extract all unique tags
        const tagsSet = new Set();
        contacts.forEach(contact => {
            if (contact.tags && Array.isArray(contact.tags)) {
                contact.tags.forEach(tag => {
                    if (tag && tag.trim()) {
                        tagsSet.add(tag.trim());
                    }
                });
            }
        });

        // Convert to array of objects with id and name
        const uniqueTags = Array.from(tagsSet).sort().map((tag, index) => ({
            id: `tag-${index}`,
            name: tag
        }));

        res.json(uniqueTags);

    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
