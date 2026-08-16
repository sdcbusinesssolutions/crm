const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

// GET /api/admin/pricing - Fetch all rates
router.get('/', async (req, res) => {
    try {
        const { currency = 'INR' } = req.query; // Default to INR if not provided
        const { data, error } = await supabaseAdmin
            .from('wa_message_rates')
            .select('*')
            .eq('currency', currency)
            .order('country_code', { ascending: true });

        if (error) throw error;
        res.json({ data: data || [] });
    } catch (error) {
        console.error('Error fetching rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/pricing/bulk - Upsert multiple rates
router.post('/bulk', async (req, res) => {
    try {
        const { rates, currency } = req.body;
        if (!rates || !Array.isArray(rates)) {
            return res.status(400).json({ error: 'Rates array is required' });
        }

        const fallbackCurrency = currency || 'INR';

        const upserts = rates.map(r => ({
            scope: r.scope || 'GLOBAL',
            category: r.category.toUpperCase(),
            country_code: r.country_code.toUpperCase(),
            meta_cost: Number(r.meta_cost),
            platform_rate: Number(r.platform_rate),
            is_active: r.is_active !== undefined ? r.is_active : true,
            user_id: r.user_id || null,
            currency: r.currency || fallbackCurrency
        }));

        // WABA Currency Validation for USER overrides
        const userOverrides = upserts.filter(r => r.user_id && r.scope === 'USER');
        if (userOverrides.length > 0) {
            const adminDomain = req.admin?.managed_domain || req.admin?.domain;
            const isSuperAdmin = req.admin?.role === 'super_admin';
            
            if (!isSuperAdmin && adminDomain) {
                const { data: domainSettings } = await supabaseAdmin
                    .from('domain_wallet_settings')
                    .select('allowed_credit_currencies')
                    .eq('domain', adminDomain)
                    .maybeSingle();
                    
                const allowedCurrencies = domainSettings?.allowed_credit_currencies || ['INR'];
                const userIds = [...new Set(userOverrides.map(r => r.user_id))];
                
                for (const uid of userIds) {
                    const { data: wabaConfig } = await supabaseAdmin
                        .from('whatsapp_config')
                        .select('currency')
                        .eq('user_id', uid)
                        .limit(1)
                        .maybeSingle();
                        
                    const wabaCurrency = wabaConfig?.currency || 'INR';
                    if (!allowedCurrencies.includes(wabaCurrency)) {
                        return res.status(403).json({
                            error: `Forbidden: User ${uid} has a ${wabaCurrency} WABA. Super Admin only allows custom rates for ${allowedCurrencies.join(', ')} WABAs.`
                        });
                    }
                }
            }
        }

        // Workaround for Postgres < 15 unique constraints with nulls:
        // Delete existing rates for these specific combinations before inserting to prevent duplicates.
        for (const r of upserts) {
            let deleteQuery = supabaseAdmin
                .from('wa_message_rates')
                .delete()
                .eq('scope', r.scope)
                .eq('category', r.category)
                .eq('country_code', r.country_code)
                .eq('currency', r.currency);

            if (r.user_id) {
                deleteQuery = deleteQuery.eq('user_id', r.user_id);
            } else {
                deleteQuery = deleteQuery.is('user_id', null);
            }
            const { error: deleteError } = await deleteQuery;
            if (deleteError) throw deleteError;
        }

        const { data, error } = await supabaseAdmin
            .from('wa_message_rates')
            .insert(upserts)
            .select();
            
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Error bulk upserting rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/pricing - Add new rate
router.post('/', async (req, res) => {
    try {
        const { scope = 'GLOBAL', user_id, category, country_code, meta_cost, platform_rate, is_active = true, currency = 'INR' } = req.body;
        
        const payload = {
            scope,
            category: category.toUpperCase(),
            country_code: country_code.toUpperCase(),
            meta_cost: Number(meta_cost),
            platform_rate: Number(platform_rate),
            is_active,
            user_id: user_id || null,
            currency: currency
        };

        if (scope !== 'GLOBAL' && user_id) {
            if (scope === 'USER') {
                const adminDomain = req.admin?.managed_domain || req.admin?.domain;
                const isSuperAdmin = req.admin?.role === 'super_admin';
                
                if (!isSuperAdmin && adminDomain) {
                    const { data: domainSettings } = await supabaseAdmin
                        .from('domain_wallet_settings')
                        .select('allowed_credit_currencies')
                        .eq('domain', adminDomain)
                        .maybeSingle();
                        
                    const allowedCurrencies = domainSettings?.allowed_credit_currencies || ['INR'];
                    const { data: wabaConfig } = await supabaseAdmin
                        .from('whatsapp_config')
                        .select('currency')
                        .eq('user_id', user_id)
                        .limit(1)
                        .maybeSingle();
                        
                    const wabaCurrency = wabaConfig?.currency || 'INR';
                    if (!allowedCurrencies.includes(wabaCurrency)) {
                        return res.status(403).json({
                            error: `Forbidden: User has a ${wabaCurrency} WABA. Super Admin only allows custom rates for ${allowedCurrencies.join(', ')} WABAs.`
                        });
                    }
                }
            }
        }

        const { data, error } = await supabaseAdmin
            .from('wa_message_rates')
            .insert([payload])
            .select()
            .single();

        if (error) throw error;
        res.json({ data });
    } catch (error) {
        console.error('Error adding rate:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/admin/pricing/:id - Update existing rate
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { meta_cost, platform_rate, is_active } = req.body;
        
        const payload = {};
        if (meta_cost !== undefined) payload.meta_cost = Number(meta_cost);
        if (platform_rate !== undefined) payload.platform_rate = Number(platform_rate);
        if (is_active !== undefined) payload.is_active = is_active;
        payload.updated_at = new Date().toISOString();

        const { data, error } = await supabaseAdmin
            .from('wa_message_rates')
            .update(payload)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ data });
    } catch (error) {
        console.error('Error updating rate:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/admin/pricing/:id - Delete rate
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('wa_message_rates')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting rate:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
