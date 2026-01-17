const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const { logCampaignRequest } = require('../utils/logger');

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

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
        const response = await axios.get(
            `${GRAPH_API_URL}/${phoneNumberId}?fields=messaging_limit_tier`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        const limits = { 'TIER_1': 1000, 'TIER_50': 50, 'TIER_250': 250, 'TIER_2': 10000, 'TIER_3': 100000, 'TIER_4': 1000000000 };
        const tier = response.data.messaging_limit_tier || 'TIER_250';
        return { tier, limit: limits[tier] || 250 };
    } catch (error) {
        console.error('Error fetching limits:', error.message);
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
router.get('/', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase.from('campaigns').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /create
router.post('/create', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        logCampaignRequest('Create Request', req.body);

        let { title, templateId, templateName, languageCode, contactGroupId, scheduledAt, sendNow, variableMapping, mediaUrl, mediaType, locationHeader, carouselMediaUrls, recipientType } = req.body;

        // Persist Carousel Media in Mapping
        if (carouselMediaUrls?.length) {
            if (!variableMapping) variableMapping = {};
            variableMapping._carousel_media = carouselMediaUrls;
        }

        // Fetch Contacts
        let validContacts = [];

        if (recipientType === 'manual') {
            const manualNumbers = req.body.manualNumbers || [];
            if (!manualNumbers.length) return res.status(400).json({ error: 'No numbers provided.' });

            // 1. Normalize Numbers
            const normalized = manualNumbers.map(num => {
                const clean = num.toString().trim().replace(/\D/g, '');
                return clean.startsWith('+') ? clean : `+${clean}`;
            }).filter(isValidE164);

            if (!normalized.length) return res.status(400).json({ error: 'No valid manual numbers found.' });

            // 2. Deduplicate
            const uniquePhones = [...new Set(normalized)];

            // 3. Find Existing in DB
            const { data: existingContacts, error: fetchErr } = await supabase
                .from('contacts')
                .select('id, phone, name, email')
                .eq('user_id', user.id)
                .in('phone', uniquePhones);

            if (fetchErr) throw fetchErr;

            // 4. Build Valid Contacts (Mix of Existing + Virtual)
            // We consciously DO NOT insert new contacts yet, based on user request.
            // We will attempt to queue them with ID=null. If DB fails, we handle it later.
            const existingMap = new Map(existingContacts.map(c => [c.phone, c]));

            validContacts = uniquePhones.map(phone => {
                if (existingMap.has(phone)) return existingMap.get(phone);
                return {
                    id: null, // Virtual Contact
                    user_id: user.id,
                    phone: phone,
                    name: 'Guest',
                    email: null,
                    is_virtual: true // Flag for later fallback
                };
            });

        } else {
            // Existing Group Logic
            if (!contactGroupId) {
                return res.status(400).json({ error: 'Audience Group is required when not using manual numbers.' });
            }

            let query = supabase.from('contacts').select('id, phone, name, email').eq('user_id', user.id);
            if (contactGroupId !== 'all') query = query.contains('group_ids', [contactGroupId]);

            const { data: contacts } = await query;
            if (!contacts?.length) return res.status(400).json({ error: 'No contacts found.' });
            validContacts = contacts;
        }

        // Validate E.164 (Double check for group contacts, though we did it for manual above too)
        validContacts = validContacts.map(c => ({ ...c, phone: c.phone.trim().replace(/\D/g, '') }))
            .map(c => ({ ...c, phone: c.phone.startsWith('+') ? c.phone : `+${c.phone}` }))
            .filter(c => isValidE164(c.phone));

        // Deduplicate Contacts (Keep unique phones)
        const uniqueContactsMap = new Map();
        validContacts.forEach(c => {
            if (!uniqueContactsMap.has(c.phone)) {
                uniqueContactsMap.set(c.phone, c);
            }
        });
        const uniqueContacts = Array.from(uniqueContactsMap.values());

        if (!uniqueContacts.length) return res.status(400).json({ error: 'No valid phone numbers.' });

        // Check Limits
        const limitInfo = await getMetaLimits(config.phone_number_id, config.meta_access_token);
        if (uniqueContacts.length > limitInfo.limit) {
            return res.status(400).json({ error: `Exceeds daily limit of ${limitInfo.limit}.` });
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

        // Add to Queue (With Fallback for Schema Constraints)
        let queue = uniqueContacts.map(c => ({
            campaign_id: campaign.id,
            contact_id: c.id,
            phone_number: c.phone,
            status: 'PENDING'
        }));

        const { error: qInitialErr } = await supabase.from('campaign_queue').insert(queue);

        if (qInitialErr) {
            // Handle Not-Null Constraint on contact_id (Postgres Code 23502)
            if (qInitialErr.code === '23502' || qInitialErr.message?.includes('contact_id')) {
                console.warn('[Campaign] contact_id constraint detected. Creating auto-contacts for manual entries...');

                const virtuals = uniqueContacts.filter(c => !c.id);
                if (virtuals.length > 0) {
                    const contactsToCreate = virtuals.map(c => ({
                        user_id: user.id,
                        phone: c.phone,
                        name: `Manual ${new Date().toISOString().split('T')[0]}`,
                        group_ids: []
                    }));

                    const { data: created, error: fallbackErr } = await supabase
                        .from('contacts')
                        .insert(contactsToCreate)
                        .select('id, phone');

                    if (fallbackErr) throw fallbackErr;

                    // Update Queue Items with new IDs
                    const phoneToId = new Map(created.map(c => [c.phone, c.id]));
                    queue = queue.map(q => {
                        if (q.contact_id) return q;
                        return { ...q, contact_id: phoneToId.get(q.phone_number) };
                    });

                    // Retry
                    const { error: retryErr } = await supabase.from('campaign_queue').insert(queue);
                    if (retryErr) throw retryErr;
                }
            } else {
                throw qInitialErr;
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
router.get('/:id', async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data } = await supabase.from('campaigns').select('*').eq('id', req.params.id).single();
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

// GET /:id/queue
router.get('/:id/queue', async (req, res) => {
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
router.get('/:id/export', async (req, res) => {
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

module.exports = router;
