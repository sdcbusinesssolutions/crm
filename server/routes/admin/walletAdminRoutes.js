const express = require('express');
const router = express.Router();
const WalletService = require('../../services/WalletService');
const { supabaseAdmin } = require('../../lib/supabaseClient');

// GET /api/wallet/admin/balance/:userId — get a specific user's wallet balance
router.get('/balance/:userId', async (req, res) => {
    try {
        const wallet = await WalletService.getWallet(req.params.userId);
        res.json(wallet);
    } catch (error) {
        console.error('Error fetching admin user balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/all-wallets — wallet overview of every user
router.get('/all-wallets', async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        let query = supabaseAdmin
            .from('user_wallets')
            .select(`
                *,
                profiles:user_id (
                    id,
                    name,
                    email,
                    signup_domain
                )
            `, { count: 'exact' })
            .order('updated_at', { ascending: false })
            .range(from, to);

        const { data, count, error } = await query;
        if (error) throw error;

        const enriched = await Promise.all((data || []).map(async (w) => {
            const { data: lastTx } = await supabaseAdmin
                .from('wallet_transactions')
                .select('created_at, type, amount, source, wa_category')
                .eq('user_id', w.user_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            const { data: stats } = await supabaseAdmin
                .rpc('get_wallet_summary', { p_user_id: w.user_id })
                .maybeSingle();

            return {
                ...w,
                last_transaction: lastTx || null,
                summary: stats || null
            };
        }));

        res.json({ data: enriched, total: count || 0, page, limit });
    } catch (error) {
        console.error('Error fetching all wallets:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/ledger/:userId — full transaction ledger
router.get('/ledger/:userId', async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        let query = supabaseAdmin
            .from('wallet_transactions')
            .select(`
                *,
                whatsapp_config:whatsapp_account_id ( phone_number )
            `, { count: 'exact' })
            .eq('user_id', targetUserId);

        if (req.query.source)    query = query.eq('source', req.query.source);
        if (req.query.category)  query = query.eq('wa_category', req.query.category.toUpperCase());
        if (req.query.type)      query = query.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) query = query.gte('created_at', req.query.date_from);
        if (req.query.date_to)   query = query.lte('created_at', req.query.date_to);

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const wallet = await WalletService.getWallet(targetUserId).catch(() => null);

        const { data: allTx } = await supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount, platform_cost, meta_cost, wa_category')
            .eq('user_id', targetUserId);

        const summary = (allTx || []).reduce((acc, tx) => {
            if (tx.type === 'DEBIT') {
                acc.total_debited += Number(tx.amount || 0);
                acc.total_meta_cost += Number(tx.meta_cost || 0);
                acc.total_platform_cost += Number(tx.platform_cost || 0);
                if (tx.wa_category) {
                    acc.by_category[tx.wa_category] = (acc.by_category[tx.wa_category] || 0) + Number(tx.amount || 0);
                }
            } else {
                acc.total_credited += Number(tx.amount || 0);
            }
            return acc;
        }, {
            total_debited: 0,
            total_credited: 0,
            total_meta_cost: 0,
            total_platform_cost: 0,
            by_category: {}
        });

        res.json({ data, total: count || 0, page, limit, wallet, summary });
    } catch (error) {
        console.error('Error fetching ledger:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/summary — aggregate platform-wide wallet stats
router.get('/summary', async (req, res) => {
    try {
        const { data: allTx } = await supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount, platform_cost, meta_cost, wa_category, source, created_at');

        const summary = (allTx || []).reduce((acc, tx) => {
            acc.total_transactions++;
            if (tx.type === 'DEBIT') {
                acc.total_platform_revenue += Number(tx.platform_cost || 0);
                acc.total_meta_cost += Number(tx.meta_cost || 0);
                acc.total_debited += Number(tx.amount || 0);
                if (tx.wa_category) {
                    acc.by_category[tx.wa_category] = (acc.by_category[tx.wa_category] || 0) + Number(tx.amount || 0);
                }
                if (tx.source) {
                    acc.by_source[tx.source] = (acc.by_source[tx.source] || 0) + 1;
                }
            } else {
                acc.total_credited += Number(tx.amount || 0);
                if (tx.source === 'REFUND') acc.total_refunds++;
                if (tx.source === 'ADJUSTMENT') acc.total_adjustments++;
            }
            return acc;
        }, {
            total_transactions: 0,
            total_debited: 0,
            total_credited: 0,
            total_platform_revenue: 0,
            total_meta_cost: 0,
            total_refunds: 0,
            total_adjustments: 0,
            by_category: {},
            by_source: {}
        });

        const { data: wallets } = await supabaseAdmin
            .from('user_wallets')
            .select('wallet_enforced, balance');

        summary.total_wallets = wallets?.length || 0;
        summary.enforced_wallets = wallets?.filter(w => w.wallet_enforced).length || 0;
        summary.total_balance_in_system = wallets?.reduce((s, w) => s + Number(w.balance || 0), 0) || 0;

        res.json(summary);
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/topup — top up a user's wallet
router.post('/topup', async (req, res) => {
    try {
        const { userId, targetUserId, amount, description, wallet_enforced } = req.body;
        const uid = userId || targetUserId;
        
        if (!uid || amount === undefined) {
            return res.status(400).json({ error: 'User ID and Amount are required' });
        }
        
        let result = null;
        if (Number(amount) !== 0) {
            result = await WalletService.addCredit(uid, Number(amount), 'ADMIN_TOPUP', description || 'Admin top-up');
        }
        
        if (wallet_enforced !== undefined) {
            await supabaseAdmin.from('user_wallets')
                .update({ wallet_enforced })
                .eq('user_id', uid);
        }
        
        res.json({ success: true, transaction: result });
    } catch (error) {
        console.error('Error topping up wallet:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/reset — reset a user's wallet to 0
router.post('/reset', async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID is required' });
        
        const wallet = await WalletService.getWallet(userId);
        if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
        
        const currentBalance = Number(wallet.balance);
        if (currentBalance !== 0) {
            const adjustmentAmount = -currentBalance;
            await WalletService.addCredit(userId, adjustmentAmount, 'ADJUSTMENT', 'Admin manual balance reset to 0');
        }
        
        res.json({ success: true, oldBalance: currentBalance, newBalance: 0 });
    } catch (error) {
        console.error('Error resetting wallet:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/rates/:userId — get rates for a user
router.get('/rates/:userId', async (req, res) => {
    try {
        const { data: rates, error } = await supabaseAdmin
            .from('wa_message_rates')
            .select('*')
            .or(`user_id.eq.${req.params.userId},scope.eq.GLOBAL`)
            .eq('is_active', true);
            
        if (error) throw error;
        res.json(rates);
    } catch (error) {
        console.error('Error fetching rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/rates — set custom rates
router.post('/rates', async (req, res) => {
    try {
        const { userId, rates } = req.body;
        
        if (!userId || !rates || !Array.isArray(rates)) {
            return res.status(400).json({ error: 'User ID and rates array are required' });
        }
        
        const upserts = rates.map(r => ({
            scope: 'WORKSPACE',
            user_id: userId,
            category: r.category,
            country_code: r.country_code || 'IN',
            meta_cost: r.meta_cost || 0.0128,
            platform_rate: r.platform_rate,
            currency: 'INR',
            updated_by: null
        }));
        
        const { error } = await supabaseAdmin
            .from('wa_message_rates')
            .upsert(upserts, { onConflict: 'scope,user_id,category,country_code' });
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/global-rates — get the global default rates
router.get('/global-rates', async (req, res) => {
    try {
        const { data: rates, error } = await supabaseAdmin
            .from('wa_message_rates')
            .select('*')
            .eq('scope', 'GLOBAL')
            .is('user_id', null)
            .eq('is_active', true);
            
        if (error) throw error;
        res.json(rates);
    } catch (error) {
        console.error('Error fetching global rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/global-rates — update global default rates
router.post('/global-rates', async (req, res) => {
    try {
        const { rates } = req.body;
        
        if (!rates || !Array.isArray(rates)) {
            return res.status(400).json({ error: 'Rates array is required' });
        }
        
        const upserts = rates.map(r => ({
            scope: 'GLOBAL',
            user_id: null,
            category: r.category,
            country_code: r.country_code || 'IN',
            meta_cost: r.meta_cost || 0.0128,
            platform_rate: r.platform_rate,
            currency: 'INR',
            updated_by: null
        }));
        
        const { error } = await supabaseAdmin
            .from('wa_message_rates')
            .upsert(upserts, { onConflict: 'scope,user_id,category,country_code' });
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting global rates:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
