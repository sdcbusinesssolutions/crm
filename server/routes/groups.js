
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');

router.get('/', async (req, res) => {
  try {
    // Use Admin to bypass row limit (for accurate counts > 1000)
    const supabase = supabaseAdmin;
    const { data, error } = await supabase
      .from('contact_groups')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const groupList = data || [];

    // Fetch contacts for accurate count (Deduplicated)
    let uniqueContacts = [];
    try {
      // Loop strategy to fetch ALL contacts for Group Counting
      let allContacts = [];
      let pageIndex = 0;
      const chunkSize = 1000;
      let hasMore = true;
      const contactsClient = supabaseAdmin || getAuthenticatedSupabase(req);

      while (hasMore) {
        const from = pageIndex * chunkSize;
        const to = from + chunkSize - 1;

        const { data: chunk, error: cErr } = await contactsClient
          .from('contacts')
          .select('id, phone, group_ids')
          .eq('user_id', req.user.id)
          .order('created_at', { ascending: false })
          .range(from, to);

        if (cErr) throw cErr;

        if (chunk && chunk.length > 0) {
          allContacts = allContacts.concat(chunk);
          if (chunk.length < chunkSize) hasMore = false;
          else pageIndex++;
        } else {
          hasMore = false;
        }
        if (allContacts.length > 150000) break;
      }

      const rawContacts = allContacts;
      // Apply same logic as contacts.js (Direct mapping, no dedupe)
      uniqueContacts = rawContacts;
    } catch (e) {
      console.error("Error calculating group counts:", e);
    }

    const formatted = groupList.map(g => {
      const count = uniqueContacts.filter(c => c.group_ids && c.group_ids.includes(g.id)).length;
      return {
        id: g.id,
        name: g.name,
        description: g.description,
        status: g.status,
        contactCount: count,
        createdAt: g.created_at,
        updatedAt: g.updated_at
      };
    });

    res.json(formatted);
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

    const { id, name, description, status } = req.body;
    const payload = { user_id: user.id, name, description, status };

    const isRealUuid = id && id.length === 36 && !id.startsWith('grp-');

    if (isRealUuid) {
      const { data, error } = await supabase.from('contact_groups').update(payload).eq('id', id).select().single();
      if (error) throw error;
      res.json(data);
    } else {
      const { data, error } = await supabase.from('contact_groups').insert([payload]).select().single();
      if (error) throw error;
      res.json(data);
    }
  } catch (err) {
    console.error("Error saving group:", err);
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { error } = await supabase.from('contact_groups').delete().eq('id', req.params.id).eq('user_id', req.user.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
