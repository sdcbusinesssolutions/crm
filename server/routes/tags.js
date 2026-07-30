const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

// GET /api/tags - Get all tags
router.get('/', requirePermission('Tags', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        
        // 1. Fetch tags from the tags table
        const { data: dbTags, error: dbError } = await supabase
            .from('tags')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (dbError) throw dbError;

        // 2. Fetch tags from contacts table (legacy tags)
        const { data: contacts, error: contactsError } = await supabase
            .from('contacts')
            .select('tags')
            .eq('user_id', req.user.id);

        if (contactsError) throw contactsError;

        const tagsMap = new Map();
        
        // Add db tags to map
        dbTags.forEach(tag => {
            tagsMap.set(tag.name.toLowerCase(), tag);
        });

        // Extract unique tags from contacts and add them if they don't exist
        if (contacts) {
            let tempIdCounter = 0;
            contacts.forEach(contact => {
                if (contact.tags && Array.isArray(contact.tags)) {
                    contact.tags.forEach(tag => {
                        if (tag && tag.trim()) {
                            const trimmedName = tag.trim();
                            const lowerName = trimmedName.toLowerCase();
                            if (!tagsMap.has(lowerName)) {
                                tagsMap.set(lowerName, {
                                    id: `temp-${tempIdCounter++}`,
                                    name: trimmedName,
                                    description: '',
                                    color: '#10b981',
                                    created_at: new Date().toISOString()
                                });
                            }
                        }
                    });
                }
            });
        }

        const allTags = Array.from(tagsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
        res.json(allTags);
    } catch (error) {
        console.error('Error fetching tags:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/tags - Create a new tag
router.post('/', requirePermission('Tags', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        const { data, error } = await supabase
            .from('tags')
            .insert([{
                name: name.trim(),
                description: description || '',
                color: color || '#10b981',
                user_id: req.user.id
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error) {
        console.error('Error creating tag:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tags/:id - Update an existing tag
router.put('/:id', requirePermission('Tags', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;
        const { name, description, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Tag name is required' });
        }

        // If the ID is a temp ID (legacy tag), we need to insert it instead of updating
        if (id.startsWith('temp-')) {
            const { data, error } = await supabase
                .from('tags')
                .insert([{
                    name: name.trim(),
                    description: description || '',
                    color: color || '#10b981',
                    user_id: req.user.id
                }])
                .select()
                .single();

            if (error) throw error;
            return res.json(data);
        }

        const { data, error } = await supabase
            .from('tags')
            .update({
                name: name.trim(),
                description: description || '',
                color: color || '#10b981',
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating tag:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/tags/:id - Delete a tag
router.delete('/:id', requirePermission('Tags', 'all_access'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        // Note: For temporary tags, we don't have a record in `tags` table to delete.
        // The user would have to remove the tag string from contacts directly.
        // We just return success if they try to delete a temp tag from the UI.
        if (id.startsWith('temp-')) {
            return res.status(204).send();
        }

        const { error } = await supabase
            .from('tags')
            .delete()
            .eq('id', id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting tag:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
