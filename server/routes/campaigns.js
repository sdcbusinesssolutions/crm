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

        let { title, templateId, templateName, languageCode, contactGroupId, scheduledAt, sendNow, variableMapping, mediaUrl, mediaType, locationHeader, carouselMediaUrls } = req.body;

        // Persist Carousel Media in Mapping
        if (carouselMediaUrls?.length) {
            if (!variableMapping) variableMapping = {};
            variableMapping._carousel_media = carouselMediaUrls;
        }

        // Fetch Contacts
        let query = supabase.from('contacts').select('id, phone, name, email').eq('user_id', user.id);
        if (contactGroupId && contactGroupId !== 'all') query = query.contains('group_ids', [contactGroupId]);

        const { data: contacts } = await query;
        if (!contacts?.length) return res.status(400).json({ error: 'No contacts found.' });

        // Validate
        const validContacts = contacts.map(c => ({ ...c, phone: c.phone.trim().replace(/\D/g, '') }))
            .map(c => ({ ...c, phone: c.phone.startsWith('+') ? c.phone : `+${c.phone}` }))
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

        // Add to Queue
        const queue = uniqueContacts.map(c => ({
            campaign_id: campaign.id, contact_id: c.id, phone_number: c.phone, status: 'PENDING'
        }));
        const { error: qErr } = await supabase.from('campaign_queue').insert(queue);
        if (qErr) throw qErr;

        // if (sendNow) {
        //     processCampaign(campaign.id, supabase, config).catch(e => console.error(e));
        // }

        if (qErr) throw qErr;

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
        const [total, sent, delivered, read, failed] = await Promise.all([
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%SENT%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%DELIVERED%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%READ%'),
            supabase.from('campaign_queue').select('*', { count: 'exact', head: true }).eq('campaign_id', req.params.id).ilike('status', '%FAILED%')
        ]);

        res.json({
            ...data,
            stats: {
                total: total.count || 0,
                sent: sent.count || 0,
                delivered: delivered.count || 0,
                read: read.count || 0,
                failed: failed.count || 0
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

module.exports = router;
