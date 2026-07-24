const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const { logCampaignRequest } = require('../utils/logger');
const requirePermission = require('../middleware/requirePermission');


const GRAPH_API_URL = 'https://graph.facebook.com/v25.0';

/* =========================================================================
   1. Helper Functions
   ========================================================================= */

async function getWhatsAppConfig(supabase, userId) {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) throw new Error('WhatsApp configuration not found.');
    return data;
}

function isValidE164(phone) {
    const regex = /^\+[1-9]\d{10,14}$/;
    return regex.test(phone);
}

async function getMetaLimits(phoneNumberId, accessToken) {
    try {
        // Per Meta docs: whatsapp_business_manager_messaging_limit is the correct (non-deprecated) field.
        // messaging_limit_tier is deprecated and often returns TIER_50/250 incorrectly.
        // Use v25.0 as shown in Meta's official example.
        const metaUrl = `${GRAPH_API_URL}/${phoneNumberId}?fields=whatsapp_business_manager_messaging_limit`;
        
        const response = await axios.get(metaUrl, { 
            headers: { 'Authorization': `Bearer ${accessToken}` },
            timeout: 10000 
        });

        const limits = {
            'TIER_50': 50,
            'TIER_250': 250,
            'TIER_1K': 1000,
            'TIER_10K': 10000,
            'TIER_100K': 100000,
            'TIER_UNLIMITED': 1000000000,
            // Legacy/Fallback Mappings
            'TIER_1': 1000,
            'TIER_2': 10000,
            'TIER_3': 100000,
            'TIER_4': 1000000000
        };

        const tier = response.data.whatsapp_business_manager_messaging_limit || 'TIER_250';
        const limitValue = limits[tier] || 250;

        console.log(`[Meta Limits] Phone ID: ${phoneNumberId}, Verified Tier: ${tier}, Limit: ${limitValue}`);
        return { tier, limit: limitValue };
    } catch (error) {
        console.error('[Meta Limits] Error fetching limits:', error.response?.data || error.message);
        // Fallback to a safe minimum
        return { tier: 'UNKNOWN', limit: 250 };
    }
}

/* =========================================================================
   2. Campaign Processing Logic
   =========================================================================
   NOTE: Campaign processing is now handled by the dedicated CampaignWorker (server/workers/campaignWorker.js).
   The inline processCampaign function and builders have been removed to prevent double-sending issues.
*/


// GET / - List
router.get('/', requirePermission('Campaigns', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        // Optimize: Only fetch columns needed for the list view
        const { data } = await supabase
            .from('campaigns')
            .select('id, title, status, total_contacts, created_at, scheduled_at, template_name')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        res.json(data || []);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /create
router.post('/create', requirePermission('Campaigns', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        logCampaignRequest('Create Request', req.body);

        let { title, templateId, templateName, languageCode, contactGroupId, scheduledAt, sendNow, variableMapping, mediaUrl, mediaType, locationHeader, carouselMediaUrls, recipientType, restrictLanguageCode } = req.body;

        // Persist Carousel Media in Mapping
        if (carouselMediaUrls?.length) {
            if (!variableMapping) variableMapping = {};
            variableMapping._carousel_media = carouselMediaUrls;
        }

        // Fetch Contacts - Robust Looping Strategy
        let allContacts = [];
        if (recipientType === 'manual') {
            const manualNumbers = req.body.manualNumbers || [];
            if (!manualNumbers.length) return res.status(400).json({ error: 'No numbers provided.' });

            // 1. Normalize Numbers
            const normalized = manualNumbers.map(num => {
                let clean = num.toString().trim().replace(/\D/g, '');
                if (clean.length === 10) clean = '91' + clean;
                return clean;
            }).filter(clean => isValidE164(`+${clean}`));

            if (!normalized.length) return res.status(400).json({ error: 'No valid manual numbers found.' });

            // 2. Deduplicate
            const uniquePhones = [...new Set(normalized)];

            // 3. Find Existing in DB (Safely chunked to avoid URL Too Long errors for 500+ contacts)
            const existingContacts = [];
            const SEARCH_CHUNK_SIZE = 200; // Safe limit for URL parameters in PostgREST

            for (let i = 0; i < uniquePhones.length; i += SEARCH_CHUNK_SIZE) {
                const phoneChunk = uniquePhones.slice(i, i + SEARCH_CHUNK_SIZE);
                const { data: chunkData, error: fetchErr } = await supabase
                    .from('contacts')
                    .select('id, phone, name, email, is_blocked, custom_data')
                    .eq('user_id', user.id)
                    .in('phone', phoneChunk);

                if (fetchErr) throw fetchErr;
                if (chunkData) existingContacts.push(...chunkData);
            }

            const existingMap = new Map(existingContacts.map(c => [c.phone, c]));
            allContacts = [];
            
            for (const phone of uniquePhones) {
                if (existingMap.has(phone)) {
                    const existing = existingMap.get(phone);
                    // Filter out opted-out or blocked contacts
                    if (existing.is_blocked || existing.custom_data?.opted_out) {
                        continue;
                    }
                    allContacts.push(existing);
                } else {
                    allContacts.push({
                        id: null, // Virtual Contact
                        user_id: user.id,
                        phone: phone,
                        name: 'Guest',
                        email: null,
                        is_virtual: true
                    });
                }
            }
        } else {
            // Group, Tags or All
            let pageIndex = 0;
            const chunkSize = 1000; // Efficient chunk size (Matches Supabase default MAX_ROWS)
            let hasMore = true;

            while (hasMore) {
                const from = pageIndex * chunkSize;
                const to = from + chunkSize - 1;

                // Optimization: Only select columns needed for the campaign queue
                let query = supabase.from('contacts')
                    .select('id, phone, is_blocked, custom_data')
                    .eq('user_id', user.id)
                    .range(from, to);
                
                // --- PUSH FILTERS TO DATABASE ---
                if (recipientType === 'group' && contactGroupId && contactGroupId !== 'all') {
                    query = query.contains('group_ids', [contactGroupId]);
                } else if (recipientType === 'tags') {
                    const selectedTags = req.body.selectedTags || [];
                    if (selectedTags.length > 0) {
                        query = query.overlaps('tags', selectedTags);
                    }
                }
                
                // Optional Date Filtering
                if (recipientType === 'group' || recipientType === 'tags') {
                    if (req.body.fromDate) {
                        query = query.gte('created_at', req.body.fromDate + 'T00:00:00Z');
                    }
                    if (req.body.toDate) {
                        query = query.lte('created_at', req.body.toDate + 'T23:59:59Z');
                    }
                }

                const { data: chunk, error: chunkErr } = await query;
                if (chunkErr) throw chunkErr;

                if (chunk && chunk.length > 0) {
                    // Quick Filter for Blocked (column) or Opted-out (custom_data)
                    const filteredChunk = chunk.filter(c => !c.is_blocked && !c.custom_data?.opted_out);

                    // Language Restriction Filter (In-memory as it's complex/json)
                    let finalChunk = filteredChunk;
                    if (restrictLanguageCode && languageCode) {
                        const targetLangPrefix = languageCode.toLowerCase().split('_')[0];
                        finalChunk = filteredChunk.filter(c => {
                            const contactLang = c.language_code || c.custom_data?.language_code;
                            if (!contactLang) return true; 
                            return contactLang.toLowerCase().split('_')[0] === targetLangPrefix;
                        });
                    }

                    // Memory optimization: Use push instead of concat
                    allContacts.push(...finalChunk);
                    if (chunk.length < chunkSize) hasMore = false;
                    else pageIndex++;
                } else {
                    hasMore = false;
                }
                if (allContacts.length > 250000) break; // Hard safety break
            }

            // (Remaining filters were pushed to DB or handled in the chunk loop above)
        }

        // Optimization: Single-pass normalization and deduplication
        const uniqueContactsMap = new Map();
        
        for (const c of allContacts) {
            let phoneStr = c.phone ? c.phone.toString().trim() : '';
            
            // Handle Excel scientific notation corruption (best effort recovery)
            if (phoneStr.toUpperCase().includes('E+')) {
                const num = Number(phoneStr);
                if (!isNaN(num)) {
                    phoneStr = num.toLocaleString('fullwide', { useGrouping: false });
                }
            }

            let cleanPhone = phoneStr.replace(/\D/g, '');
            
            // Auto-fix missing country code for 10-digit Indian numbers
            if (cleanPhone.length === 10) {
                cleanPhone = '91' + cleanPhone;
            }

            const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;
            
            if (isValidE164(formattedPhone) && !uniqueContactsMap.has(formattedPhone)) {
                uniqueContactsMap.set(formattedPhone, {
                    ...c,
                    phone: formattedPhone
                });
            }
        }
        const uniqueContacts = Array.from(uniqueContactsMap.values());

        if (!uniqueContacts.length) return res.status(400).json({ error: 'No valid phone numbers.' });

        // Check Limits
        const limitInfo = await getMetaLimits(config.phone_number_id, config.meta_access_token);
        if (uniqueContacts.length > limitInfo.limit) {
            return res.status(400).json({
                error: `Exceeds daily limit of ${limitInfo.limit} (Meta Tier: ${limitInfo.tier}). You are attempting to send to ${uniqueContacts.length} contacts.`
            });
        }

        // Create Campaign
        const { data: campaign, error: cErr } = await supabase.from('campaigns').insert({
            user_id: user.id, title, template_id: templateId, template_name: templateName,
            language_code: languageCode, contact_group_id: contactGroupId,
            scheduled_at: sendNow ? new Date() : scheduledAt,
            status: sendNow ? 'PROCESSING' : 'SCHEDULED',
            total_contacts: uniqueContacts.length,
            variable_mapping: variableMapping,
            media_url: mediaUrl, media_type: mediaType, location_header: locationHeader
        }).select().single();

        if (cErr) throw cErr;

        // Add to Queue (With Fallback for Chunking & Performance)
        const QUEUE_BATCH_SIZE = 2000;
        const baseTime = sendNow ? Date.now() : new Date(scheduledAt).getTime();
        const delayMs = parseInt(req.body.messageDelay) * 1000 || 0;

        let queue = uniqueContacts.map((c, idx) => ({
            campaign_id: campaign.id,
            contact_id: c.id,
            phone_number: c.phone,
            status: 'PENDING',
            next_retry_at: delayMs > 0 ? new Date(baseTime + (idx * delayMs)).toISOString() : null
        }));

        let insertError = null;

        // Try Chunked Insert
        for (let i = 0; i < queue.length; i += QUEUE_BATCH_SIZE) {
            const batch = queue.slice(i, i + QUEUE_BATCH_SIZE);
            const { error: batchErr } = await supabase.from('campaign_queue').insert(batch);
            
            if (batchErr) {
                // If it's a contact_id missing error for manual entries, we handle it below
                if (batchErr.code === '23502' || batchErr.message?.includes('contact_id')) {
                    insertError = batchErr;
                    break; 
                } else {
                    throw batchErr;
                }
            }
        }

        if (insertError) {
            // Handle Not-Null Constraint on contact_id (Postgres Code 23502)
            // Creating auto-contacts for manual entries before retrying queue
            const virtuals = uniqueContacts.filter(c => !c.id);
            if (virtuals.length > 0) {
                console.log(`[Campaign] Creating ${virtuals.length} auto-contacts for manual entries...`);
                
                const CONTACT_BATCH_SIZE = 1000;
                const phoneToId = new Map();

                for (let i = 0; i < virtuals.length; i += CONTACT_BATCH_SIZE) {
                    const chunk = virtuals.slice(i, i + CONTACT_BATCH_SIZE).map(c => ({
                        user_id: user.id,
                        phone: c.phone,
                        name: `Manual Contact`,
                        group_ids: []
                    }));

                    const { data: created, error: chunkErr } = await supabase
                        .from('contacts')
                        .insert(chunk)
                        .select('id, phone');

                    if (chunkErr) throw chunkErr;
                    created.forEach(c => phoneToId.set(c.phone, c.id));
                }

                // Update Queue Items with new IDs
                queue = queue.map(q => {
                    if (q.contact_id) return q;
                    return { ...q, contact_id: phoneToId.get(q.phone_number) };
                });

                // Re-attempt Whole Queue Insert in Batches
                for (let i = 0; i < queue.length; i += QUEUE_BATCH_SIZE) {
                    const batch = queue.slice(i, i + QUEUE_BATCH_SIZE);
                    const { error: retryErr } = await supabase.from('campaign_queue').insert(batch);
                    if (retryErr) throw retryErr;
                }
            }
        }

        // Log Campaign Creation
        try {
            logCampaignRequest('CREATE_CAMPAIGN', {
                userId: user.id,
                campaignId: campaign.id,
                title,
                contactsCount: uniqueContacts.length,
                templateName,
                scheduledAt: sendNow ? 'NOW' : scheduledAt
            });
        } catch (ignore) { }

        res.json({ success: true, campaignId: campaign.id });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// GET /:id details
router.get('/:id', requirePermission('Campaigns', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from('campaigns').select('*').eq('id', req.params.id).eq('user_id', user.id).single();
        if (!data) throw new Error('Not found');

        // Stats
        // Use independent queries to avoid any builder reuse issues
        const [total, sent, delivered, read, failed, processing] = await Promise.all([
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%SENT%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%DELIVERED%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%READ%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%FAILED%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).in('status', ['PROCESSING', 'PENDING']) // Group pending/processing? Or separate? Let's just do PROCESSING.
        ]);

        // Actually, let's be more precise.
        // PENDING is important.
        const pending = await supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).eq('status', 'PENDING');
        const processingCount = await supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).eq('status', 'PROCESSING');


        res.json({
            ...data,
            stats: {
                total: total.count || 0,
                sent: sent.count || 0,
                delivered: delivered.count || 0,
                read: read.count || 0,
                failed: failed.count || 0,
                processing: processingCount.count || 0,
                pending: pending.count || 0
            }
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/phones - Extract phone numbers
router.get('/:id/phones', requirePermission('Campaigns', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { status } = req.query;

        let query = supabase
            .from('campaign_queue')
            .select('phone_number')
            .eq('campaign_id', req.params.id);

        if (status && status !== 'all') {
            query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) throw error;

        const phones = data.map(d => d.phone_number);
        res.json({ phones });

    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/queue
router.get('/:id/queue', requirePermission('Campaigns', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const { data, count } = await supabase
            .from('campaign_queue')
            .select('*, contacts(name)', { count: 'exact' })
            .eq('campaign_id', req.params.id)
            .range(offset, offset + limit - 1)
            .order('updated_at', { ascending: false });

        res.json({
            data: data.map(d => ({ ...d, contact_name: d.contacts?.name })),
            total: count,
            page,
            totalPages: Math.ceil(count / limit)
        });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /:id/export - Export Campaign Report
router.get('/:id/export', requirePermission('Campaigns', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);

        // Fetch all queue items with contact details
        const { data, error } = await supabase
            .from('campaign_queue')
            .select(`
                *,
                contacts ( name, phone, email )
            `)
            .eq('campaign_id', req.params.id)
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // CSV Header
        const headers = ['Contact Name', 'Phone Number', 'Status', 'Message ID', 'Error Message', 'Sent At', 'Last Update'];
        const rows = [headers.join(',')];

        // CSV Rows
        data.forEach(item => {
            const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;

            const name = item.contacts?.name || 'Unknown';
            const phone = item.phone_number || '';
            const status = item.status || 'PENDING';
            const msgId = item.message_id || '';
            const errorMsg = item.error_message || '';
            const sentAt = item.sent_at ? new Date(item.sent_at).toISOString() : '';
            const updatedAt = item.updated_at ? new Date(item.updated_at).toISOString() : '';

            const row = [
                escape(name),
                escape(phone),
                escape(status),
                escape(msgId),
                escape(errorMsg),
                escape(sentAt),
                escape(updatedAt)
            ];
            rows.push(row.join(','));
        });

        const csvContent = rows.join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="campaign_${req.params.id}_report.csv"`);
        res.send(csvContent);

    } catch (e) {
        console.error('Export Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE /:id - Delete Campaign
router.delete('/:id', requirePermission('Campaigns', 'all_access'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();

        // Check if campaign belongs to user first
        const { data: campaign } = await supabase.from('campaigns').select('id').eq('id', req.params.id).eq('user_id', user.id).single();
        if (!campaign) throw new Error('Campaign not found or unauthorized');

        // 1. Delete associated queue items first (if cascade isn't set, better safe)
        const { error: queueError } = await supabase
            .from('campaign_queue')
            .delete()
            .eq('campaign_id', req.params.id);

        if (queueError) throw queueError;

        // 2. Delete the campaign
        const { error } = await supabase
            .from('campaigns')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (e) {
        console.error('Delete Error:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
