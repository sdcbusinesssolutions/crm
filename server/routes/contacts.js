
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');

// GET /api/contacts
router.get('/', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Deduplicate by phone number manually
    const uniqueContacts = [];
    const seenPhones = new Set();

    (data || []).forEach(c => {
      // Normalize phone if present, otherwise use unique ID to treat as unique
      const key = c.phone ? String(c.phone).trim() : `id:${c.id}`;

      if (!seenPhones.has(key)) {
        seenPhones.add(key);
        uniqueContacts.push(c);
      }
    });

    const formatted = uniqueContacts.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      status: c.status,
      source: c.source,
      tags: c.tags || [],
      groupIds: c.group_ids || [],
      customData: c.custom_data || {},
      createdAt: c.created_at,
      updatedAt: c.updated_at || (c.custom_data && c.custom_data.updated_at)
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error fetching contacts:', err);
    // Code 42P01 means table undefined. Return empty array instead of crashing.
    if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts
router.post('/', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const user = req.user; // populated by requireAuth middleware

    if (!user || !user.id) {
      return res.status(401).json({ error: 'User context missing' });
    }

    const { id, name, phone, email, status, source, tags, groupIds, customData } = req.body;

    const payload = {
      user_id: user.id,
      name: name || 'Unknown',
      phone: phone || '',
      email,
      status,
      source,
      tags: tags || [],
      group_ids: groupIds || [],
      custom_data: customData || {}
    };

    let result;
    // Check if it's an update (has valid UUID) or insert (has temp ID or no ID)
    const isRealUuid = id && id.length === 36 && !id.startsWith('cnt-');

    console.log(`Working with contact ID: ${id}, isUpdate: ${isRealUuid}`);

    if (isRealUuid) {
      console.log('Updating existing contact...');

      // Store updated_at in custom_data since the column might not exist
      const now = new Date().toISOString();
      const newCustomData = { ...(payload.custom_data || {}), updated_at: now };
      const updatePayload = { ...payload, custom_data: newCustomData };

      // Try to update without the root updated_at column first to avoid errors
      // console.log('Update payload updated_at:', updatePayload.updated_at);

      const { data, error } = await supabase
        .from('contacts')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update error:', error);
        throw error;
      }
      console.log('Update successful, returned updated_at:', data?.custom_data?.updated_at);
      result = data;
    } else {
      console.log('Inserting new contact...');
      const { data, error } = await supabase
        .from('contacts')
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }


    // Update groups updated_at if contact is assigned to groups
    if (groupIds && Array.isArray(groupIds) && groupIds.length > 0) {
      await supabase
        .from('contact_groups')
        .update({ updated_at: new Date().toISOString() })
        .in('id', groupIds)
        .eq('user_id', user.id);
    }

    res.json(result);
  } catch (err) {
    console.error('Error saving contact:', err);
    res.status(500).json({ error: err.message });
  }
});

// TEST endpoint - remove after debugging
router.get('/bulk-test', (req, res) => {
  console.log('🧪 Bulk test endpoint hit!');
  res.json({ message: 'Bulk endpoint is accessible', user: req.user ? 'authenticated' : 'not authenticated' });
});

// POST /api/contacts/bulk
router.post('/bulk', async (req, res) => {
  console.log('📦 Bulk import endpoint hit');
  try {
    const supabase = getAuthenticatedSupabase(req);
    const user = req.user;

    if (!user || !user.id) {
      console.log('❌ User context missing');
      return res.status(401).json({ error: 'User context missing' });
    }

    const contacts = req.body;
    console.log(`📊 Received ${Array.isArray(contacts) ? contacts.length : 0} contacts`);

    if (!Array.isArray(contacts)) {
      return res.status(400).json({ error: 'Expected an array of contacts' });
    }

    if (contacts.length === 0) {
      return res.json([]);
    }

    const payload = contacts.map(c => ({
      user_id: user.id,
      name: c.name || 'Unknown',
      phone: c.phone || '',
      email: c.email,
      status: c.status || 'New',
      source: c.source || 'Import',
      tags: c.tags || [],
      group_ids: c.groupIds || [],
      custom_data: c.customData || {}
    }));

    const { data, error } = await supabase
      .from('contacts')
      .insert(payload)
      .select();

    if (error) throw error;

    console.log(`✅ Successfully imported ${data.length} contacts`);

    // Update updated_at for all affected groups
    const affectedGroupIds = new Set();
    contacts.forEach(c => {
      if (c.groupIds && Array.isArray(c.groupIds)) {
        c.groupIds.forEach(gid => affectedGroupIds.add(gid));
      }
    });

    if (affectedGroupIds.size > 0) {
      await supabase
        .from('contact_groups')
        .update({ updated_at: new Date().toISOString() })
        .in('id', Array.from(affectedGroupIds))
        .eq('user_id', user.id);
    }

    res.json(data);
  } catch (err) {
    console.error('Error bulk saving contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/bulk-delete
router.post('/bulk-delete', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { ids } = req.body; // Expects { ids: ['id1', 'id2'] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided for deletion' });
    }

    const { error } = await supabase
      .from('contacts')
      .delete()
      .in('id', ids)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true, count: ids.length });
  } catch (err) {
    console.error('Error bulk deleting contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
