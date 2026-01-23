
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');

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
      // group_ids handled below to prevent wiping on partial updates
      custom_data: customData || {}
    };

    // Check if it's an update (has valid UUID) or insert (has temp ID or no ID)
    const isRealUuid = id && id.length === 36 && !id.startsWith('cnt-');

    if (isRealUuid) {
      // For updates, only include group_ids if explicitly provided
      if (groupIds !== undefined) {
        payload.group_ids = groupIds;
      }
    } else {
      // For new contacts, default to empty array if not provided
      payload.group_ids = groupIds || [];
    }

    let result;

    console.log(`Working with contact ID: ${id}, isUpdate: ${isRealUuid}`);

    if (isRealUuid) {
      console.log('Updating existing contact...');

      // 1. Fetch existing contact to get current custom_data
      const { data: existing, error: fetchErr } = await supabase
        .from('contacts')
        .select('custom_data')
        .eq('id', id)
        .single();

      if (fetchErr) {
        console.warn("Could not fetch existing custom_data for merge, proceeding with overwrite", fetchErr);
      }

      // 2. Merge existing data with new payload
      const existingCustom = existing?.custom_data || {};
      const newCustom = payload.custom_data || {};

      const now = new Date().toISOString();
      // Merge: Existing gets priority? No, New payload should overwrite collisions, but keep others.
      const mergedCustomData = {
        ...existingCustom,
        ...newCustom,
        updated_at: now
      };

      const updatePayload = {
        ...payload,
        custom_data: mergedCustomData
      };

      // 3. Perform Update
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
      console.log('Inserting new contact (checking for duplicates first)...');

      // 1. Check for duplicate phone number
      const { data: duplicate, error: dupError } = await supabase
        .from('contacts')
        .select('id, custom_data, group_ids')
        .eq('user_id', user.id)
        .eq('phone', payload.phone)
        .maybeSingle();

      if (duplicate) {
        console.log(`Duplicate found (ID: ${duplicate.id}). Updating instead of inserting.`);

        // 2. Setup Merge Logic for Duplicate
        const existingCustom = duplicate.custom_data || {};
        const newCustom = payload.custom_data || {};

        // Merge Groups: Add new groups to existing ones
        const existingGroups = duplicate.group_ids || [];
        const newGroups = payload.group_ids || [];
        const mergedGroups = [...new Set([...existingGroups, ...newGroups])];

        const mergedCustomData = {
          ...existingCustom,
          ...newCustom,
          updated_at: new Date().toISOString()
        };

        const updatePayload = {
          ...payload,
          group_ids: mergedGroups,
          custom_data: mergedCustomData
        };

        const { data, error } = await supabase
          .from('contacts')
          .update(updatePayload)
          .eq('id', duplicate.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // 3. Normal Insert
        const { data, error } = await supabase
          .from('contacts')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        result = data;
      }
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

const { logCRMEvent, logContactImportEvent } = require('../utils/logger'); // Import Logger

// POST /api/contacts/bulk
router.post('/bulk', async (req, res) => {
  console.log('📦 Bulk import endpoint hit');
  const startTime = Date.now();

  try {
    const supabase = getAuthenticatedSupabase(req);
    const user = req.user;

    if (!user || !user.id) {
      console.log('❌ User context missing');
      logContactImportEvent('IMPORT_FAIL_AUTH', { ip: req.ip, error: 'User context missing' });
      return res.status(401).json({ error: 'User context missing' });
    }

    const contacts = req.body;
    console.log(`📊 Received ${Array.isArray(contacts) ? contacts.length : 0} contacts`);

    // Log Request Start
    logContactImportEvent('IMPORT_START', {
      userId: user.id,
      count: Array.isArray(contacts) ? contacts.length : 0,
      timestamp: new Date().toISOString()
    });

    if (!Array.isArray(contacts)) {
      logContactImportEvent('IMPORT_FAIL_VALIDATION', { userId: user.id, error: 'Not an array' });
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

    if (error) {
      logContactImportEvent('IMPORT_DB_ERROR', { userId: user.id, error: error.message, code: error.code });
      throw error;
    }

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

    // Log Success
    const duration = Date.now() - startTime;
    logContactImportEvent('IMPORT_SUCCESS', {
      userId: user.id,
      count: data.length,
      durationMs: duration
    });

    res.json(data);
  } catch (err) {
    console.error('Error bulk saving contacts:', err);
    logContactImportEvent('IMPORT_EXCEPTION', { error: err.message, stack: err.stack });
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

    // 1. Fetch Phones (needed for some lookups)
    let phones = [];
    try {
      const { data: contactsData } = await supabaseAdmin
        .from('contacts')
        .select('phone')
        .in('id', ids);
      if (contactsData) phones = contactsData.map(c => c.phone).filter(Boolean);
    } catch (e) { }

    // 2. Strict Delete Dependencies (Tables that definitely have contact_id and must be cleared)
    // CRITICAL: campaign_queue often blocks deletion. We delete by contact_id. 
    // We do NOT filter by user_id here because campaign_queue might not have it, 
    // and contact_id is sufficiently unique (UUID).
    try {
      const { error: qErr } = await supabaseAdmin
        .from('campaign_queue')
        .delete()
        .in('contact_id', ids);

      if (qErr) console.warn("[Bulk Delete] campaign_queue delete error:", qErr.message);
    } catch (e) {
      console.warn("[Bulk Delete] campaign_queue exception:", e.message);
    }

    try {
      const { error: wfsErr } = await supabaseAdmin
        .from('whatsapp_flow_submissions')
        .delete()
        .in('contact_id', ids); // Assuming this table has contact_id
    } catch (e) { }

    // 3. Try to Unlink/Delete other potential dependencies (Best Effort)
    // The previous error logs showed 'contact_id' column missing for many tables.
    // So we only try to update if we are sure, or just suppress errors.
    // If conversations are linked via phone, we don't need to do anything if there is no FK.
    // If there IS a FK on phone, we might have trouble. But standard setup is usually loose coupling on phone.

    // We skip the generic 'update contact_id=null' loop because those tables apparently don't have that column.

    // Final Delete using Admin to ensure RLS doesn't block it (though we still check user_id)
    const { data: deleted, error } = await supabaseAdmin
      .from('contacts')
      .delete()
      .in('id', ids)
      .eq('user_id', req.user.id)
      .select();

    if (error) {
      console.error("Final Bulk Delete Error:", error);
      throw error;
    }

    console.log(`[Bulk Delete] Deleted ${deleted ? deleted.length : 0} contacts.`);
    res.json({ success: true, count: deleted ? deleted.length : 0 });
  } catch (err) {
    console.error('Error bulk deleting contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const id = req.params.id;
    const userId = req.user.id; // Correctly get user ID from request

    // 1. Verify Existence & Ownership (Admin bypass for lookup)
    const { data: contact, error: fetchErr } = await supabaseAdmin
      .from('contacts')
      .select('id, user_id, phone')
      .eq('id', id)
      .single();

    if (fetchErr || !contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    if (contact.user_id !== userId) {
      console.warn(`[Delete] Ownership mismatch for ${id}. Owner: ${contact.user_id}, Requestor: ${userId}`);
      // Return 404 to hide existence, or 403. Be honest for debugging.
      return res.status(403).json({ error: 'Unauthorized: You do not own this contact.' });
    }

    console.log(`[Delete] Deleting contact ${id} (Phone: ${contact.phone})...`);

    // 2. Unlink Historical Data (Preserve History)
    // We attempt to set contact_id = NULL. 
    // Added 'messages' to this list.
    const unlinkTables = [
      'conversations',
      'leads',
      'tasks',
      'notes',
      'appointments',
      'flow_sessions',
      'messages'
    ];

    for (const table of unlinkTables) {
      try {
        await supabaseAdmin
          .from(table)
          .update({ contact_id: null })
          .eq('contact_id', id);
      } catch (e) {
        // console.warn(`[Delete] Unlink failed for ${table}:`, e.message);
      }
    }

    // 3. Unlink by Phone (Special handling for Conversation persistence)
    // If we rely on phone linking, we might want to Leave the phone number in the conversation
    // so the history is readable, but breaking the link to the (now deleted) contact UUID.
    // However, if the contact is deleted, the 'contact_phone' column is just a string, so it persists fine.
    // We don't need to nullify it.

    // 4. Delete Strict Dependencies
    // campaign_queue MUST be deleted as it implies a future action for this specific ID.
    try {
      await supabaseAdmin.from('campaign_queue').delete().eq('contact_id', id);
    } catch (e) {
      console.warn(`[Delete] Failed to clear campaign_queue:`, e.message);
    }

    // whatsapp_flow_submissions: Try unlink, else delete
    try {
      const { error: wfsErr } = await supabaseAdmin.from('whatsapp_flow_submissions').update({ contact_id: null }).eq('contact_id', id);
      if (wfsErr) throw wfsErr;
    } catch (e) {
      try { await supabaseAdmin.from('whatsapp_flow_submissions').delete().eq('contact_id', id); } catch (del) { }
    }

    // 5. Final Delete
    const { error: delErr, count } = await supabaseAdmin
      .from('contacts')
      .delete()
      .eq('id', id);
    // Removed .eq('user_id') here because we already verified ownership above 
    // and we are using Admin client which doesn't know about the RLS context anyway in this call 
    // (unless using setting request context, which we aren't).
    // We rely on the initial check.

    if (delErr) {
      console.error("[Delete] Final delete failed:", delErr);
      throw delErr;
    }

    console.log(`[Delete] Successfully deleted contact ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('[Delete] Route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
