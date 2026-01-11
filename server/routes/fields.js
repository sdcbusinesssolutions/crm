
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

router.get('/', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { data, error } = await supabase
      .from('custom_fields')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    // Code 42P01 means table undefined. Return empty array instead of crashing.
    if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
        return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
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

router.delete('/:id', async (req, res) => {
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
