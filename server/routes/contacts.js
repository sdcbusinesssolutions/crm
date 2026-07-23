
const express = require('express');
const router = express.Router();
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const requirePermission = require('../middleware/requirePermission');
const requireAuth = require('../middleware/requireAuth');


// GET /api/contacts
router.get('/', requirePermission('Contact+List', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Default 50, Max 100
    const userId = req.user.id;

    // --- ENFORCED PAGINATION MODE ---
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabaseAdmin
      .from('contacts')
      .select('id, name, phone, email, status, source, tags, group_ids, custom_data, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Filter by assigned leads if restricted
    if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
      const { data: assignedLeads } = await supabaseAdmin
        .from('leads')
        .select('phone')
        .eq('user_id', userId)
        .contains('assigned_staff_ids', [req.staff.staffId]);
      
      const assignedPhones = (assignedLeads || []).map(l => l.phone).filter(Boolean);
      if (assignedPhones.length > 0) {
        query = query.in('phone', assignedPhones);
      } else {
        query = query.in('phone', ['dummy-no-phone']);
      }
    }

    // --- SEARCH FILTERING ---
    if (req.query.search) {
      const s = req.query.search.replace(/,/g, '');
      if (s) {
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
      }
    }

    // --- GROUP FILTERING ---
    if (req.query.groupId) {
      query = query.contains('group_ids', [req.query.groupId]);
    }

    // --- TAG FILTERING ---
    if (req.query.tag) {
      query = query.contains('tags', [req.query.tag]);
    }

    // --- OPT STATUS FILTERING ---
    console.log('[Contacts GET] optStatus filter:', req.query.optStatus);
    if (req.query.optStatus === 'opted_out') {
      query = query.contains('custom_data', '{"opted_out":true}');
    } else if (req.query.optStatus === 'opted_in') {
      query = query.or('custom_data.is.null,custom_data.not.cs.{"opted_out":true}');
    }

    // --- DATE FILTERING ---
    if (req.query.startDate) {
      query = query.gte('created_at', req.query.startDate);
    }
    if (req.query.endDate) {
      query = query.lte('created_at', req.query.endDate);
    }

    const { data: rawData, count, error } = await query.range(from, to);

    if (error) throw error;

    const formatted = (rawData || []).map(c => ({
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

    // Always return paginated structure to prevent frontend crashes
    return res.json({
      data: formatted,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (err) {
    console.error('Error fetching contacts:', err);
    // Code 42P01 means table undefined. Return empty array instead of crashing.
    if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
      if (req.query.page) return res.json({ data: [], total: 0 }); // pagination fallback
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/export - Fetch all contacts for downloading
router.get('/export', requirePermission('Contact+List', 'read'), async (req, res) => {
  try {
    const userId = req.user.id;
    let allContacts = [];
    let pageIndex = 0;
    const chunkSize = 1000; // Efficient chunk size (Matches Supabase default MAX_ROWS)
    let hasMore = true;

    // Fetch pipeline dictionaries for mapping
    const { data: allPipelines } = await supabaseAdmin.from('pipelines').select('id, name').eq('user_id', userId);
    const { data: allStages } = await supabaseAdmin.from('pipeline_stages').select('id, name').eq('user_id', userId);
    const pipelineMap = {};
    (allPipelines || []).forEach(p => pipelineMap[p.id] = p.name);
    const stageMap = {};
    (allStages || []).forEach(s => stageMap[s.id] = s.name);

    while (hasMore) {
      const from = pageIndex * chunkSize;
      const to = from + chunkSize - 1;

      let query = supabaseAdmin
        .from('contacts')
        .select('id, name, phone, email, status, source, tags, group_ids, custom_data, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Filter by assigned leads if restricted
      if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
        const { data: assignedLeads } = await supabaseAdmin
          .from('leads')
          .select('phone')
          .eq('user_id', userId)
          .contains('assigned_staff_ids', [req.staff.staffId]);
        
        const assignedPhones = (assignedLeads || []).map(l => l.phone).filter(Boolean);
        if (assignedPhones.length > 0) {
          query = query.in('phone', assignedPhones);
        } else {
          query = query.in('phone', ['dummy-no-phone']);
        }
      }

      // Apply same filters if present
      if (req.query.search) {
        const s = req.query.search.replace(/,/g, '');
        query = query.or(`name.ilike.%${s}%,phone.ilike.%${s}%,email.ilike.%${s}%`);
      }
      if (req.query.groupId) query = query.contains('group_ids', [req.query.groupId]);
      if (req.query.tag) query = query.contains('tags', [req.query.tag]);
      if (req.query.optStatus === 'opted_out') query = query.contains('custom_data', '{"opted_out":true}');
      if (req.query.optStatus === 'opted_in') query = query.or('custom_data.is.null,custom_data.not.cs.{"opted_out":true}');
      if (req.query.startDate) query = query.gte('created_at', req.query.startDate);
      if (req.query.endDate) query = query.lte('created_at', req.query.endDate);

      const { data: chunk, error } = await query.range(from, to);
      if (error) throw error;

      if (chunk && chunk.length > 0) {
        // Fetch leads for this chunk to get pipeline assignments
        const chunkPhones = chunk.map(c => c.phone).filter(Boolean);
        let leadsByPhone = {};
        if (chunkPhones.length > 0) {
          const { data: chunkLeads } = await supabaseAdmin
            .from('leads')
            .select('phone, pipeline_id, stage_id')
            .eq('user_id', userId)
            .in('phone', chunkPhones);
            
          (chunkLeads || []).forEach(lead => {
            if (!leadsByPhone[lead.phone]) leadsByPhone[lead.phone] = [];
            const pName = pipelineMap[lead.pipeline_id] || 'Unknown';
            const sName = stageMap[lead.stage_id] || 'Unknown';
            leadsByPhone[lead.phone].push(`${pName} (${sName})`);
          });
        }

        const enhancedChunk = chunk.map(c => ({
          ...c,
          pipelines_string: leadsByPhone[c.phone] ? leadsByPhone[c.phone].join(' | ') : ''
        }));

        allContacts = allContacts.concat(enhancedChunk);
        if (chunk.length < chunkSize) hasMore = false;
        else pageIndex++;
      } else {
        hasMore = false;
      }

      // Hard limit for safety (1 million)
      if (allContacts.length > 1000000) break;
    }

    const formatted = allContacts.map(c => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      status: c.status,
      source: c.source,
      tags: c.tags || [],
      groupIds: c.group_ids || [],
      customData: c.custom_data || {},
      pipelines_string: c.pipelines_string,
      createdAt: c.created_at
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Error exporting contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/phones - Fetch ONLY phone numbers matching filters
router.get('/phones', requirePermission('Contact+List', 'read'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const userId = req.user.id;
    const { search, groupId, tag, startDate, endDate, optStatus } = req.query;

    let query = supabase.from('contacts').select('phone').eq('user_id', userId);

    // Filter by assigned leads if restricted
    if (req.staff && req.staff.permissions && req.staff.permissions.only_assigned_leads === 'all_access') {
      const { data: assignedLeads } = await supabaseAdmin
        .from('leads')
        .select('phone')
        .eq('user_id', userId)
        .contains('assigned_staff_ids', [req.staff.staffId]);
      
      const assignedPhones = (assignedLeads || []).map(l => l.phone).filter(Boolean);
      if (assignedPhones.length > 0) {
        query = query.in('phone', assignedPhones);
      } else {
        query = query.in('phone', ['dummy-no-phone']);
      }
    }

    if (search) {
      const searchTerms = search.split(' ').filter(t => t.length > 0);
      if (searchTerms.length > 0) {
        const orConditions = searchTerms.map(term => 
          `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
        ).join(',');
        query = query.or(orConditions);
      }
    }
    if (groupId) query = query.contains('group_ids', [groupId]);
    if (tag) query = query.contains('tags', [tag]);
    if (optStatus === 'opted_out') query = query.contains('custom_data', '{"opted_out":true}');
    if (optStatus === 'opted_in') query = query.or('custom_data.is.null,custom_data.not.cs.{"opted_out":true}');
    if (startDate) query = query.gte('created_at', startDate);
    if (endDate) query = query.lte('created_at', endDate);

    const { data, error } = await query;
    if (error) throw error;

    // Clean and Unique
    const phones = Array.from(new Set(
      data
        .map(c => c.phone ? c.phone.toString().replace(/[^0-9+]/g, '') : null)
        .filter(Boolean)
    ));
    
    res.json(phones);
  } catch (err) {
    console.error('Error fetching phones:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/contacts/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('id, name, whatsapp_name, phone, email, status')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Contact not found' });
    
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts
router.post('/', requirePermission('Contact+List', 'read_write'), async (req, res) => {
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
        .select('custom_data, tags')
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

      // Check for added tags
      const oldTags = existing?.tags || [];
      const newTags = payload.tags || [];
      const addedTags = newTags.filter(t => !oldTags.includes(t));
      const removedTags = oldTags.filter(t => !newTags.includes(t));

      if (addedTags.length > 0) {
        // Run async (fire and forget)
        DripTriggerService.handleTagAdded(user.id, data, addedTags).catch(err => console.error('Trigger Error:', err));
      }
      if (removedTags.length > 0) {
        DripTriggerService.handleTagRemoved(user.id, data, removedTags).catch(err => console.error('Removal Trigger Error:', err));
      }

      result = data;
    } else {
      console.log('Inserting new contact (checking for duplicates first)...');

      // 1. Check for duplicate phone number
      const { data: duplicate, error: dupError } = await supabase
        .from('contacts')
        .select('id, custom_data, group_ids, tags')
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

        // Check for added tags in duplicate merge
        const oldTags = duplicate.tags || [];
        const newTags = payload.tags || [];
        const addedTags = newTags.filter(t => !oldTags.includes(t));

        if (addedTags.length > 0) {
          DripTriggerService.handleTagAdded(user.id, data, addedTags).catch(err => console.error('Dup Trigger Error:', err));
        }
      } else {
        // 3. Normal Insert
        const { data, error } = await supabase
          .from('contacts')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;

        // Trigger for new contact
        if (payload.tags && payload.tags.length > 0) {
          DripTriggerService.handleTagAdded(user.id, data, payload.tags).catch(err => console.error('Insert Trigger Error:', err));
        }

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
router.get('/bulk-test', requirePermission('Contact+List', 'read'), (req, res) => {
  console.log('🧪 Bulk test endpoint hit!');
  res.json({ message: 'Bulk endpoint is accessible', user: req.user ? 'authenticated' : 'not authenticated' });
});

const { logCRMEvent, logContactImportEvent } = require('../utils/logger'); // Import Logger

// POST /api/contacts/bulk
router.post('/bulk', requirePermission('Contact+List', 'read_write'), async (req, res) => {
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

    // Batch Processing Config
    const CHUNK_SIZE = 200; // Safe limit for Supabase/PostgREST
    const chunkedResults = [];
    const stats = { inserted: 0, duplicates: 0, failed: 0 };
    const totalContacts = payload.length;

    console.log(`🚀 Starting batch insert for ${totalContacts} contacts in chunks of ${CHUNK_SIZE}...`);

    for (let i = 0; i < totalContacts; i += CHUNK_SIZE) {
      const chunk = payload.slice(i, i + CHUNK_SIZE);
      const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
      console.log(`Processing chunk ${chunkIndex} (${chunk.length} items)...`);

      // 1. Separate into new vs duplicates by querying existing phones
      const chunkPhones = chunk.map(c => c.phone).filter(Boolean);
      let existingPhoneMap = {};
      
      if (chunkPhones.length > 0) {
        const { data: existingContacts } = await supabaseAdmin
          .from('contacts')
          .select('id, phone, group_ids')
          .eq('user_id', user.id)
          .in('phone', chunkPhones);
          
        if (existingContacts) {
          existingContacts.forEach(c => {
            existingPhoneMap[c.phone] = c;
          });
        }
      }

      const newContactsToInsert = [];
      
      for (const item of chunk) {
        const existing = existingPhoneMap[item.phone];
        
        if (existing) {
          // Handle Duplicate
          stats.duplicates++;
          try {
            // Merge Groups
            const newGroups = item.group_ids || [];
            const currentGroups = existing.group_ids || [];
            const mergedGroups = [...new Set([...currentGroups, ...newGroups])];

            // Only Update if changed
            if (mergedGroups.length > currentGroups.length) {
              await supabaseAdmin
                .from('contacts')
                .update({ group_ids: mergedGroups })
                .eq('id', existing.id);
            }

            chunkedResults.push(existing);
          } catch (mergeErr) {
            console.error('⚠️ Group merge failed for duplicate:', mergeErr);
          }
        } else {
          // New contact
          newContactsToInsert.push(item);
          // Mark as existing so duplicates within the same CSV chunk are caught
          if (item.phone) {
             existingPhoneMap[item.phone] = { id: 'pending', group_ids: item.group_ids || [] };
          }
        }
      }

      // 2. Batch Insert New Contacts
      if (newContactsToInsert.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('contacts')
          .insert(newContactsToInsert)
          .select();

        if (error) {
          console.warn(`⚠️ Batch insert failed (${error.message}). Retrying items individually...`);
          logContactImportEvent('IMPORT_BATCH_FAIL_RETRY', {
            userId: user.id,
            chunkIndex: chunkIndex,
            error: error.message
          });

          // Serial Retry
          for (const item of newContactsToInsert) {
            const { data: itemData, error: itemError } = await supabaseAdmin
              .from('contacts')
              .insert([item])
              .select();

            if (itemError) {
              stats.failed++;
              console.error(`❌ Item Failed: ${item.name} (${item.phone}) - ${itemError.message}`);
              logContactImportEvent('IMPORT_ITEM_FAIL', {
                userId: user.id,
                phone: item.phone,
                name: item.name,
                reason: itemError.message
              });
            } else if (itemData) {
              stats.inserted++;
              chunkedResults.push(...itemData);
              
              // Trigger drip
              itemData.forEach(c => {
                if (c.tags && c.tags.length > 0) {
                  DripTriggerService.handleTagAdded(user.id, c, c.tags).catch(err => console.error('Bulk Trigger Error:', err));
                }
              });
            }
          }
        } else if (data) {
          stats.inserted += data.length;
          chunkedResults.push(...data);

          // TRIGGER DRIP CAMPAIGNS for Bulk Inserted Contacts
          data.forEach(c => {
            if (c.tags && c.tags.length > 0) {
              DripTriggerService.handleTagAdded(user.id, c, c.tags).catch(err => console.error('Bulk Trigger Error:', err));
            }
          });
        }
      }
    }

    // Assign combined data for response
    const data = chunkedResults;
    const error = null;

    console.log(`✅ Import Complete. Stats:`, stats);

    // --- PIPELINES / LEADS IMPORT ---
    try {
      const leadsToInsert = [];
      const pipelinesMap = {};
      contacts.forEach(c => {
        if (c.importPipelines && c.importPipelines.length > 0) {
          pipelinesMap[c.phone] = c.importPipelines;
        }
      });
      
      const phonesWithPipelines = Object.keys(pipelinesMap);
      if (phonesWithPipelines.length > 0) {
        // Fetch existing leads for these phones to avoid duplicating the exact same pipeline assignment
        const { data: existingLeads } = await supabaseAdmin
          .from('leads')
          .select('phone, pipeline_id, stage_id')
          .eq('user_id', user.id)
          .in('phone', phonesWithPipelines);
          
        const existingLeadsSet = new Set();
        (existingLeads || []).forEach(l => existingLeadsSet.add(`${l.phone}-${l.pipeline_id}`));

        for (const phone of phonesWithPipelines) {
          const contact = chunkedResults.find(c => c.phone === phone);
          const name = contact ? contact.name : 'Unknown';
          const email = contact ? contact.email : '';
          const company = contact && contact.custom_data ? contact.custom_data.company : '';
          const source = contact ? contact.source : 'Import';

          pipelinesMap[phone].forEach(p => {
            if (!existingLeadsSet.has(`${phone}-${p.pipelineId}`)) {
              leadsToInsert.push({
                user_id: user.id,
                name: name,
                phone: phone,
                email: email,
                company: company,
                pipeline_id: p.pipelineId,
                stage_id: p.stageId,
                source: source,
                status: 'active'
              });
              // avoid duplicate insertions in the same chunk
              existingLeadsSet.add(`${phone}-${p.pipelineId}`);
            }
          });
        }
        
        if (leadsToInsert.length > 0) {
          await supabaseAdmin.from('leads').insert(leadsToInsert);
        }
      }
    } catch (leadErr) {
      console.error('[Bulk Import] Leads/Pipelines insertion failed:', leadErr.message);
    }



    // Update updated_at for all affected groups (best effort — column may not exist)
    try {
      const affectedGroupIds = new Set();
      contacts.forEach(c => {
        if (c.groupIds && Array.isArray(c.groupIds)) {
          c.groupIds.forEach(gid => affectedGroupIds.add(gid));
        }
      });

      if (affectedGroupIds.size > 0) {
        await supabaseAdmin
          .from('contact_groups')
          .update({ updated_at: new Date().toISOString() })
          .in('id', Array.from(affectedGroupIds))
          .eq('user_id', user.id);
      }
    } catch (groupUpdateErr) {
      console.warn('[Bulk Import] contact_groups updated_at update failed:', groupUpdateErr.message);
      // Non-critical — don't crash the import for this
    }

    // Log Success Summary
    const duration = Date.now() - startTime;
    logContactImportEvent('IMPORT_SUMMARY', {
      userId: user.id,
      stats,
      durationMs: duration
    });

    res.json({ data, stats });
  } catch (err) {
    console.error('Error bulk saving contacts:', err);
    logContactImportEvent('IMPORT_EXCEPTION', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// Helper to run tasks with concurrency limit
async function runWithConcurrencyLimit(tasks, limit = 10) {
  const results = [];
  const executing = new Set();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// Helper: Process IDs in chunks to avoid Supabase/PostgREST .in() query limits
async function chunkedDelete(table, column, ids, chunkSize = 200, concurrency = 5) {
  let totalDeleted = 0;
  const tasks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    tasks.push(async () => {
      try {
        const { error, count } = await supabaseAdmin
          .from(table)
          .delete({ count: 'exact' })
          .in(column, chunk);
        if (error) {
          console.warn(`[chunkedDelete] ${table}.${column} chunk error:`, error.message);
        } else {
          totalDeleted += (count || 0);
        }
      } catch (e) {
        console.warn(`[chunkedDelete] ${table}.${column} chunk exception:`, e.message);
      }
    });
  }
  await runWithConcurrencyLimit(tasks, concurrency);
  return totalDeleted;
}

// Helper: Nullify contact_id in chunks (for tables where we want to preserve history)
async function chunkedNullify(table, column, ids, chunkSize = 200, concurrency = 5) {
  const tasks = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    tasks.push(async () => {
      try {
        await supabaseAdmin
          .from(table)
          .update({ [column]: null })
          .in(column, chunk);
      } catch (e) {
        // Column may not exist in some setups — silently skip
      }
    });
  }
  await runWithConcurrencyLimit(tasks, concurrency);
}

// POST /api/contacts/bulk-delete
router.post('/bulk-delete', requirePermission('Contact+List', 'read_write'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const { ids } = req.body; // Expects { ids: ['id1', 'id2'] }

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No IDs provided for deletion' });
    }

    console.log(`[Bulk Delete] Starting deletion of ${ids.length} contacts for user ${req.user.id}...`);

    // 1. Clean STRICT FK dependencies concurrently (these block contact deletion)
    const strictDepTables = ['campaign_queue', 'whatsapp_flow_submissions', 'drip_enrollments', 'follow_ups'];
    await Promise.all(strictDepTables.map(async (table) => {
      try {
        const count = await chunkedDelete(table, 'contact_id', ids);
        if (count > 0) console.log(`[Bulk Delete] Cleaned ${count} rows from ${table}`);
      } catch (e) {
        console.warn(`[Bulk Delete] ${table} cleanup error:`, e.message);
      }
    }));

    // 2. Safe Unlink concurrently — Preserve historical data (set contact_id = NULL)
    // Same as single delete route: keeps conversations, leads, messages etc. intact
    const unlinkTables = ['conversations', 'leads', 'tasks', 'notes', 'appointments', 'flow_sessions', 'messages', 'drip_logs'];
    await Promise.all(unlinkTables.map(table => chunkedNullify(table, 'contact_id', ids)));

    // 3. Final Delete — process in chunks concurrently
    let totalDeleted = 0;
    const CHUNK_SIZE = 200;
    const deleteTasks = [];
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      deleteTasks.push(async () => {
        const { data: deleted, error } = await supabaseAdmin
          .from('contacts')
          .delete()
          .in('id', chunk)
          .eq('user_id', req.user.id)
          .select('id');

        if (error) {
          console.error(`[Bulk Delete] Chunk delete error:`, error.message);
        } else {
          totalDeleted += (deleted ? deleted.length : 0);
        }
      });
    }
    await runWithConcurrencyLimit(deleteTasks, 5); // 5 concurrent chunk deletes

    console.log(`[Bulk Delete] Successfully deleted ${totalDeleted} of ${ids.length} contacts.`);
    res.json({ success: true, count: totalDeleted });
  } catch (err) {
    console.error('Error bulk deleting contacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/bulk-delete-filtered
router.post('/bulk-delete-filtered', requirePermission('Contact+List', 'read_write'), async (req, res) => {
  try {
    const supabase = getAuthenticatedSupabase(req);
    const userId = req.user.id;
    const { search, groupId, tag, startDate, endDate, optStatus } = req.query;

    console.log(`[Bulk Delete Filtered] Request from user ${userId} with filters:`, { search, groupId, tag, startDate, endDate, optStatus });

    // 1. Fetch ALL matching IDs (paginate to handle Supabase row limits)
    let allIds = [];
    let pageIndex = 0;
    const FETCH_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = pageIndex * FETCH_SIZE;
      const to = from + FETCH_SIZE - 1;

      let query = supabaseAdmin.from('contacts').select('id').eq('user_id', userId).range(from, to);

      if (search) {
        const searchTerms = search.split(' ').filter(t => t.length > 0);
        if (searchTerms.length > 0) {
          const orConditions = searchTerms.map(term => 
            `name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`
          ).join(',');
          query = query.or(orConditions);
        }
      }
      if (groupId) query = query.contains('group_ids', [groupId]);
      if (tag) query = query.contains('tags', [tag]);
      if (optStatus === 'opted_out') query = query.contains('custom_data', '{"opted_out":true}');
      if (optStatus === 'opted_in') query = query.or('custom_data.is.null,custom_data.not.cs.{"opted_out":true}');
      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);

      const { data: chunk, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      if (chunk && chunk.length > 0) {
        allIds = allIds.concat(chunk.map(c => c.id));
        if (chunk.length < FETCH_SIZE) hasMore = false;
        else pageIndex++;
      } else {
        hasMore = false;
      }

      // Safety limit
      if (allIds.length > 100000) break;
    }

    if (allIds.length === 0) {
      return res.json({ success: true, count: 0, message: 'No contacts matched filters' });
    }

    console.log(`[Bulk Delete Filtered] Found ${allIds.length} contacts matching filters.`);

    // 2. Clean STRICT FK dependencies concurrently
    const strictDepTables = ['campaign_queue', 'whatsapp_flow_submissions', 'drip_enrollments', 'follow_ups'];
    await Promise.all(strictDepTables.map(async (table) => {
      try {
        const cleaned = await chunkedDelete(table, 'contact_id', allIds);
        if (cleaned > 0) console.log(`[Bulk Delete Filtered] Cleaned ${cleaned} rows from ${table}`);
      } catch (e) {
        console.warn(`[Bulk Delete Filtered] ${table} cleanup error:`, e.message);
      }
    }));

    // 3. Safe Unlink concurrently — Preserve historical data (set contact_id = NULL)
    const unlinkTables = ['conversations', 'leads', 'tasks', 'notes', 'appointments', 'flow_sessions', 'messages', 'drip_logs'];
    await Promise.all(unlinkTables.map(table => chunkedNullify(table, 'contact_id', allIds)));

    // 4. Final Delete in chunks concurrently
    let totalDeleted = 0;
    const DEL_CHUNK = 200;
    const deleteTasks = [];
    for (let i = 0; i < allIds.length; i += DEL_CHUNK) {
      const chunk = allIds.slice(i, i + DEL_CHUNK);
      deleteTasks.push(async () => {
        const { count, error: delErr } = await supabaseAdmin
          .from('contacts')
          .delete({ count: 'exact' })
          .in('id', chunk)
          .eq('user_id', userId);

        if (delErr) {
          console.error(`[Bulk Delete Filtered] Chunk error:`, delErr.message);
        } else {
          totalDeleted += (count || 0);
        }
      });
    }
    await runWithConcurrencyLimit(deleteTasks, 5); // 5 concurrent chunk deletes

    console.log(`[Bulk Delete Filtered] Successfully deleted ${totalDeleted} contacts for user ${userId}`);
    res.json({ success: true, count: totalDeleted });

  } catch (err) {
    console.error('Error in bulk-delete-filtered:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/contacts/bulk-delete-all
router.post('/bulk-delete-all', requirePermission('Contact+List', 'all_access'), async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(`[Wipe CRM] User ${userId} requested full CRM wipeout.`);

    // 1. Fetch ALL contact IDs for this user (paginate for large datasets)
    let allIds = [];
    let pageIndex = 0;
    const FETCH_SIZE = 1000;
    let hasMore = true;

    while (hasMore) {
      const from = pageIndex * FETCH_SIZE;
      const to = from + FETCH_SIZE - 1;

      const { data: chunk, error: idErr } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .range(from, to);

      if (idErr) throw idErr;

      if (chunk && chunk.length > 0) {
        allIds = allIds.concat(chunk.map(c => c.id));
        if (chunk.length < FETCH_SIZE) hasMore = false;
        else pageIndex++;
      } else {
        hasMore = false;
      }

      // Safety limit
      if (allIds.length > 1000000) break;
    }

    console.log(`[Wipe CRM] Found ${allIds.length} contacts to delete.`);

    if (allIds.length > 0) {
      // 2. Clean STRICT FK dependencies concurrently (these block contact deletion)
      const strictDepTables = ['campaign_queue', 'whatsapp_flow_submissions', 'drip_enrollments', 'follow_ups'];
      await Promise.all(strictDepTables.map(async (table) => {
        try {
          const cleaned = await chunkedDelete(table, 'contact_id', allIds);
          if (cleaned > 0) console.log(`[Wipe CRM] Cleaned ${cleaned} rows from ${table}`);
        } catch (e) {
          console.warn(`[Wipe CRM] ${table} cleanup error:`, e.message);
        }
      }));

      // 3. Safe Unlink concurrently — Preserve historical data (set contact_id = NULL)
      // Keeps conversations, leads, messages, tasks etc. readable after wipe
      const unlinkTables = ['conversations', 'leads', 'tasks', 'notes', 'appointments', 'flow_sessions', 'messages', 'drip_logs'];
      await Promise.all(unlinkTables.map(table => chunkedNullify(table, 'contact_id', allIds)));
    }

    // 4. Final Wipe in chunks concurrently
    let totalDeleted = 0;
    const DEL_CHUNK = 200;
    const deleteTasks = [];
    for (let i = 0; i < allIds.length; i += DEL_CHUNK) {
      const chunk = allIds.slice(i, i + DEL_CHUNK);
      deleteTasks.push(async () => {
        const { count, error } = await supabaseAdmin
          .from('contacts')
          .delete({ count: 'exact' })
          .in('id', chunk)
          .eq('user_id', userId);

        if (error) {
          console.error(`[Wipe CRM] Chunk error:`, error.message);
        } else {
          totalDeleted += (count || 0);
        }
      });
    }
    await runWithConcurrencyLimit(deleteTasks, 5); // 5 concurrent chunk deletes

    console.log(`[Wipe CRM] Successfully wiped ${totalDeleted} contacts for user ${userId}`);
    res.json({ success: true, count: totalDeleted });

  } catch (err) {
    console.error('Error in bulk-delete-all:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/contacts/:id
router.delete('/:id', requirePermission('Contact+List', 'all_access'), async (req, res) => {
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

