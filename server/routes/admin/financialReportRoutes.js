const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../../lib/supabaseClient');

router.get('/', async (req, res) => {
    try {
        const adminDomain = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;
        
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin' || 
            adminDomain === MASTER_DOMAIN || 
            adminDomain === 'localhost' ||
            req.admin?.email === 'user7@gmail.com';
            
        console.log(`[Finance Report] email: ${req.admin?.email}, role: ${adminRole}, domain: ${adminDomain}, isSuperAdmin: ${isSuperAdmin}`);

        // Base query for transactions to get spend/deposit in the period
        let query = supabaseAdmin
            .from('wallet_transactions')
            .select('user_id, amount, type');

        // Apply tenant isolation
        if (!isSuperAdmin) {
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', adminDomain);
            const validIds = (validProfiles || []).map(p => p.id);
            if (validIds.length === 0) return res.json({ data: [] });
            query = query.in('user_id', validIds);
        } else if (req.query.domain) {
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', req.query.domain);
            const validIds = (validProfiles || []).map(p => p.id);
            if (validIds.length === 0) return res.json({ data: [] });
            query = query.in('user_id', validIds);
        }

        // Apply date filters
        if (req.query.date_from) {
            query = query.gte('created_at', req.query.date_from);
        }
        if (req.query.date_to) {
            query = query.lte('created_at', req.query.date_to);
        }

        const { data: txData, error: txError } = await query;
        if (txError) throw txError;

        // Aggregate spend and deposit by user_id
        const userAggregations = {};
        for (const tx of (txData || [])) {
            if (!userAggregations[tx.user_id]) {
                userAggregations[tx.user_id] = { deposited: 0, spend: 0 };
            }
            if (tx.type === 'CREDIT') {
                userAggregations[tx.user_id].deposited += Number(tx.amount || 0);
            } else if (tx.type === 'DEBIT') {
                userAggregations[tx.user_id].spend += Number(tx.amount || 0);
            }
        }

        // Fetch users (profiles)
        let profilesQuery = supabaseAdmin
            .from('profiles')
            .select('id, name, email, contact_number, signup_domain');

        if (!isSuperAdmin) {
            profilesQuery = profilesQuery.eq('signup_domain', adminDomain);
        } else if (req.query.domain) {
            profilesQuery = profilesQuery.eq('signup_domain', req.query.domain);
        }

        const { data: profiles, error: profileError } = await profilesQuery;
        if (profileError) throw profileError;

        const profileIds = profiles.map(p => p.id);

        let walletMap = {};
        let configMap = {};

        if (profileIds.length > 0) {
            // Fetch user wallets
            let walletsQuery = supabaseAdmin
                .from('user_wallets')
                .select('user_id, balance, billing_mode, wallet_enforced');
            if (!isSuperAdmin) {
                walletsQuery = walletsQuery.in('user_id', profileIds);
            }
            const { data: wallets } = await walletsQuery;
                
            walletMap = (wallets || []).reduce((acc, w) => {
                acc[w.user_id] = w;
                return acc;
            }, {});

            // Fetch configs
            let configsQuery = supabaseAdmin
                .from('whatsapp_config')
                .select('user_id, whatsapp_business_account_id, phone_number');
            if (!isSuperAdmin) {
                configsQuery = configsQuery.in('user_id', profileIds);
            }
            const { data: configs } = await configsQuery;
                
            configMap = (configs || []).reduce((acc, c) => {
                acc[c.user_id] = c;
                return acc;
            }, {});
        }

        // Combine data
        const reportData = profiles.map(p => {
            const agg = userAggregations[p.id] || { deposited: 0, spend: 0 };
            const walletInfo = walletMap[p.id] || {};
            const current_balance = walletInfo.balance || 0;
            const billing_mode = walletInfo.billing_mode || 'DIRECT_META';
            const wallet_enforced = walletInfo.wallet_enforced || false;
            
            const wabaConfig = configMap[p.id] || {};
            
            // For phone number, prefer WABA phone, fallback to profile contact_number
            const phoneNumber = wabaConfig.phone_number || p.contact_number || '—';

            return {
                user_id: p.id,
                email: p.email,
                name: p.name,
                phone: phoneNumber,
                waba_id: wabaConfig.whatsapp_business_account_id || '—',
                current_balance,
                deposited_balance: agg.deposited,
                spend_balance: agg.spend,
                billing_mode,
                wallet_enforced
            };
        });

        res.json({ data: reportData });
    } catch (error) {
        console.error('Error in finance report:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
