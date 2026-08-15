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

        // Calculate all-time totals
        const { data: allTx } = await supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount')
            .eq('user_id', req.user.id);
            
        let totalCredit = 0;
        let totalDebit = 0;
        
        if (allTx) {
            for (const tx of allTx) {
                if (tx.type === 'CREDIT') totalCredit += Number(tx.amount || 0);
                if (tx.type === 'DEBIT') totalDebit += Number(tx.amount || 0);
            }
        }

        res.json({ ...wallet, thisMonthExpense, totalCredit, totalDebit });
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
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            query = query.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            query = query.lte('created_at', toStr);
        }
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

        // Summary Calculation based on filters
        let summaryQuery = supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount')
            .eq('user_id', userId);

        if (req.query.source)   summaryQuery = summaryQuery.eq('source', req.query.source);
        if (req.query.category) summaryQuery = summaryQuery.eq('wa_category', req.query.category.toUpperCase());
        if (req.query.type)     summaryQuery = summaryQuery.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            summaryQuery = summaryQuery.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            summaryQuery = summaryQuery.lte('created_at', toStr);
        }
        if (req.query.whatsapp_account_id) summaryQuery = summaryQuery.eq('whatsapp_account_id', req.query.whatsapp_account_id);

        const { data: summaryData } = await summaryQuery;
        
        const summary = { totalCredit: 0, totalDebit: 0 };
        if (summaryData) {
            for (const tx of summaryData) {
                if (tx.type === 'CREDIT') summary.totalCredit += Number(tx.amount || 0);
                if (tx.type === 'DEBIT') summary.totalDebit += Number(tx.amount || 0);
            }
        }

        res.json({ data, total: count || 0, page, limit, summary });
    } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
