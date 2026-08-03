const express = require('express');
const router = express.Router();
const WalletService = require('../services/WalletService');
const requirePermission = require('../middleware/requirePermission');
const { supabaseAdmin } = require('../lib/supabaseClient');

// ─────────────────────────────────────────────────────────────────────────────
// USER ROUTES (own wallet)
// ─────────────────────────────────────────────────────────────────────────────

// Get own wallet balance and enforcement status
router.get('/balance', requirePermission('Settings', 'read'), async (req, res) => {
    try {
        const wallet = await WalletService.getWallet(req.user.id);
        
        // Calculate current month's expenses
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const { data: expenses } = await supabaseAdmin
            .from('wallet_transactions')
            .select('amount')
            .eq('user_id', req.user.id)
            .eq('type', 'DEBIT')
            .gte('created_at', startOfMonth.toISOString());
            
        const thisMonthExpense = (expenses || []).reduce((sum, tx) => sum + Number(tx.amount), 0);

        res.json({ ...wallet, thisMonthExpense });
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get own wallet transactions history (paginated + filterable)
router.get('/transactions', requirePermission('Settings', 'read'), async (req, res) => {
    try {
        const userId = req.user.id;
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;
        
        let query = supabaseAdmin
            .from('wallet_transactions')
            .select('*, whatsapp_config:whatsapp_account_id(phone_number)', { count: 'exact' })
            .eq('user_id', userId);

        if (req.query.source)   query = query.eq('source', req.query.source);
        if (req.query.category) query = query.eq('wa_category', req.query.category.toUpperCase());
        if (req.query.type)     query = query.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) query = query.gte('created_at', req.query.date_from);
        if (req.query.date_to)   query = query.lte('created_at', req.query.date_to);
        if (req.query.whatsapp_account_id) query = query.eq('whatsapp_account_id', req.query.whatsapp_account_id);

        const { data: rawData, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        
        let data = rawData || [];
        
        // Fetch Admin Profiles for ADMIN_TOPUP created_by references
        const adminIds = [...new Set(data.filter(tx => tx.created_by).map(tx => tx.created_by))];
        if (adminIds.length > 0) {
            const { data: adminProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id, name, email')
                .in('id', adminIds);
                
            const adminMap = (adminProfiles || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});
            
            data = data.map(tx => ({
                ...tx,
                admin_profile: tx.created_by ? (adminMap[tx.created_by] || null) : null
            }));
        }

        res.json({ data, total: count || 0, page, limit });
    } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
