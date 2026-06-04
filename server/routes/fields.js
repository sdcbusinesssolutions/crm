
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');

router.get('/', requirePermission(['Input Fields', 'Pipelines', 'Contact List'], 'read'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Fetch explicit definition
    const { data: explicitFields, error: explicitErr } = await supabase
      .from('custom_fields')
      .select('*')
      .order('created_at', { ascending: true });

    if (explicitErr && explicitErr.code !== '42P01') throw explicitErr;

    // 2. Discover implicit keys from recent contacts
    // This handles CSV imports where users didn't create explicit field definitions
    const { data: contacts, error: contactErr } = await supabase
      .from('contacts')
      .select('custom_data')
      .not('custom_data', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200);

    const explicitNames = new Set((explicitFields || []).map(f => f.name.toLowerCase()));

    // Use a Map to store unique keys found, preserving the first encountered casing
    const discoveredMap = new Map();

    if (contacts && contacts.length > 0) {
      contacts.forEach(c => {
        if (c.custom_data && typeof c.custom_data === 'object' && !Array.isArray(c.custom_data)) {
          Object.keys(c.custom_data).forEach(key => {
            if (!key) return; // Skip empty keys
            const lower = key.toLowerCase();

            // Allow discovery even if similar to explicit, but generally we want to avoid duplicates.
            // If explicit has "Age" and we find "age", skip.
            // If explict has "Age" and we find "City", add.
            if (!explicitNames.has(lower) && !discoveredMap.has(lower)) {
              discoveredMap.set(lower, {
                id: `auto-${key}`,
                name: key, // Preserve original casing (e.g. "Mobile No")
                type: 'text',
                placeholder: `Mapped from ${key}`,
                is_implicit: true
              });
            }
          });
        }
      });
    }

    const discoveredFields = Array.from(discoveredMap.values());
    const combined = [...(explicitFields || []), ...discoveredFields];
    res.json(combined);
  } catch (err) {
    // Code 42P01 means table undefined. Return empty array instead of crashing.
    if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
      return res.json([]);
    }
    console.error("Error fetching fields:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requirePermission('Input Fields', 'read_write'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const user = req.user;

    if (!user || !user.id) return res.status(401).json({ error: 'User context missing' });

    const { id, name, type, placeholder } = req.body;
    const payload = { user_id: user.id, name, type, placeholder };

    const isRealUuid = id && id.length === 36 && !id.startsWith('inp-');

    if (isRealUuid) {
      const { data, error } = await supabase.from('custom_fields').update(payload).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } else {
      const { data, error } = await supabase.from('custom_fields').insert([payload]).select().single();
      if (error) throw error;
      res.json(data);
    }
  } catch (err) {
    console.error("Error saving field:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requirePermission('Input Fields', 'all_access'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { error } = await supabase.from('custom_fields').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
