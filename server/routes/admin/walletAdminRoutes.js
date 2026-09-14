const express = require('express');
const router = express.Router();
const WalletService = require('../../services/WalletService');
const { supabaseAdmin } = require('../../lib/supabaseClient');
const axios = require('axios');

// GET /api/wallet/admin/balance/:userId — get a specific user's wallet balance
router.get('/balance/:userId', async (req, res) => {
    try {
        const wallet = await WalletService.getWallet(req.params.userId);

        // Fetch user's domain and settings to inform the frontend
        const { data: profile } = await supabaseAdmin.from('profiles').select('signup_domain').eq('id', req.params.userId).single();
        if (profile && profile.signup_domain) {
            const { data: domainSettings } = await supabaseAdmin.from('domain_wallet_settings').select('allow_tenant_billing_control, default_billing_mode').eq('domain', profile.signup_domain).single();
            if (domainSettings) {
                wallet.allow_tenant_billing_control = domainSettings.allow_tenant_billing_control;
                wallet.default_billing_mode = domainSettings.default_billing_mode;
            } else {
                wallet.allow_tenant_billing_control = true;
                wallet.default_billing_mode = 'DIRECT_META';
            }
        }

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

        const adminDomain   = req.admin?.managed_domain || req.admin?.domain;
        const adminRole = req.admin?.role;
        const isSuperAdmin = adminRole === 'super_admin' || 
            adminDomain === 'cloudospire.in' ||
            (req.admin?.email === 'user7@gmail.com') ||
            (req.admin?.email && req.admin.email.toLowerCase() === 'admin@localhost.com');

        let query = supabaseAdmin
            .from('user_wallets')
            .select(`
                *,
                profiles!inner (
                    id,
                    name,
                    email,
                    signup_domain
                )
            `, { count: 'exact' })
            .order('updated_at', { ascending: false });

        if (!isSuperAdmin) {
            query = query.eq('profiles.signup_domain', adminDomain);
        }

        query = query.range(from, to);

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
        const adminDomain  = req.admin?.managed_domain || req.admin?.domain;
        const isSuperAdmin = req.admin?.role === 'super_admin';

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

        if (!isSuperAdmin) {
            query = query.eq('tenant_domain', adminDomain);
        }

        if (req.query.source)    query = query.eq('source', req.query.source);
        if (req.query.category)  query = query.eq('wa_category', req.query.category.toUpperCase());
        if (req.query.type)      query = query.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            query = query.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            query = query.lte('created_at', toStr);
        }

        const { data: txData, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        const wallet = await WalletService.getWallet(targetUserId).catch(() => null);

        let summaryQuery = supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount, platform_cost, meta_cost, wa_category')
            .eq('user_id', targetUserId);

        if (!isSuperAdmin) {
            summaryQuery = summaryQuery.eq('tenant_domain', adminDomain);
        }
        if (req.query.source)    summaryQuery = summaryQuery.eq('source', req.query.source);
        if (req.query.category)  summaryQuery = summaryQuery.eq('wa_category', req.query.category.toUpperCase());
        if (req.query.type)      summaryQuery = summaryQuery.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            summaryQuery = summaryQuery.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            summaryQuery = summaryQuery.lte('created_at', toStr);
        }

        const { data: allTx } = await summaryQuery;

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

        let enrichedData = txData || [];
        
        // Fetch Admin Profiles for ADMIN_TOPUP created_by references
        const adminIds = [...new Set(enrichedData.filter(tx => tx.created_by).map(tx => tx.created_by))];
        if (adminIds.length > 0) {
            const { data: adminProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id, name, email')
                .in('id', adminIds);
                
            const adminMap = (adminProfiles || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});
            
            // Enrich data with admin details
            enrichedData = enrichedData.map(tx => ({
                ...tx,
                admin_profile: tx.created_by ? (adminMap[tx.created_by] || null) : null
            }));
        }

        res.json({ data: enrichedData, total: count || 0, page, limit, wallet, summary });
    } catch (error) {
        console.error('Error fetching ledger:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/domain-ledger — Domain-wide or Platform-wide financial reporting
router.get('/domain-ledger', async (req, res) => {
    try {
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 50;
        const from  = (page - 1) * limit;
        const to    = from + limit - 1;

        const adminDomain   = req.admin?.managed_domain || req.admin?.domain;
        const adminRole     = req.admin?.role;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL ? new URL(process.env.VITE_MASTER_URL).hostname : 'clickube.com';
        const isSuperAdmin  = adminRole === 'super_admin' || adminDomain === MASTER_DOMAIN || adminDomain === 'localhost' || req.admin?.email === 'user7@gmail.com';

        let query = supabaseAdmin
            .from('wallet_transactions')
            .select('*, whatsapp_config:whatsapp_account_id(whatsapp_business_account_id)', { count: 'exact' });

        // Domain isolation
        if (!isSuperAdmin) {
            // Tenant Admin: strict isolation
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', adminDomain);
            const validIds = (validProfiles || []).map(p => p.id);
            if (validIds.length === 0) return res.json({ data: [], total: 0, page, limit, summary: null });
            query = query.in('user_id', validIds);
        } else if (req.query.domain) {
            // Super Admin: optionally filter by tenant
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', req.query.domain);
            const validIds = (validProfiles || []).map(p => p.id);
            if (validIds.length === 0) return res.json({ data: [], total: 0, page, limit, summary: null });
            query = query.in('user_id', validIds);
        }

        // Filters
        if (req.query.source)    query = query.eq('source', req.query.source);
        if (req.query.type)      query = query.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            query = query.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            query = query.lte('created_at', toStr);
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (req.query.user_id && uuidRegex.test(req.query.user_id)) {
            query = query.eq('user_id', req.query.user_id);
        }
        
        if (req.query.user_search) {
            const { data: searchProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .or(`email.ilike.%${req.query.user_search}%,name.ilike.%${req.query.user_search}%`);
            
            if (searchProfiles && searchProfiles.length > 0) {
                const ids = searchProfiles.map(p => p.id);
                query = query.in('user_id', ids);
            } else {
                return res.json({ data: [], total: 0, page, limit, summary: null });
            }
        }

        const { data: txData, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        let data = txData || [];
        
        // Fetch profiles separately to avoid PostgREST relationship errors
        if (data.length > 0) {
            const userIds = [...new Set(data.map(tx => tx.user_id))];
            const { data: profiles } = await supabaseAdmin
                .from('profiles')
                .select('id, name, email, signup_domain')
                .in('id', userIds);
                
            const profileMap = (profiles || []).reduce((acc, p) => {
                acc[p.id] = p;
                return acc;
            }, {});
            
            data = data.map(tx => ({
                ...tx,
                profiles: profileMap[tx.user_id] || null
            }));
        }

        // Fetch aggregation summary (without pagination limits)
        let summaryQuery = supabaseAdmin
            .from('wallet_transactions')
            .select('type, amount, platform_cost, meta_cost, source');

        if (!isSuperAdmin) {
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', adminDomain);
            const validIds = (validProfiles || []).map(p => p.id);
            summaryQuery = summaryQuery.in('user_id', validIds.length ? validIds : ['00000000-0000-0000-0000-000000000000']);
        } else if (req.query.domain) {
            const { data: validProfiles } = await supabaseAdmin.from('profiles').select('id').eq('signup_domain', req.query.domain);
            const validIds = (validProfiles || []).map(p => p.id);
            summaryQuery = summaryQuery.in('user_id', validIds.length ? validIds : ['00000000-0000-0000-0000-000000000000']);
        }
        
        if (req.query.user_id && uuidRegex.test(req.query.user_id)) {
            summaryQuery = summaryQuery.eq('user_id', req.query.user_id);
        }
        if (req.query.source)    summaryQuery = summaryQuery.eq('source', req.query.source);
        if (req.query.type)      summaryQuery = summaryQuery.eq('type', req.query.type.toUpperCase());
        if (req.query.date_from) {
            const fromStr = req.query.date_from.includes('T') ? req.query.date_from : `${req.query.date_from}T00:00:00.000Z`;
            summaryQuery = summaryQuery.gte('created_at', fromStr);
        }
        if (req.query.date_to) {
            const toStr = req.query.date_to.includes('T') ? req.query.date_to : `${req.query.date_to}T23:59:59.999Z`;
            summaryQuery = summaryQuery.lte('created_at', toStr);
        }
        
        if (req.query.user_search) {
            const { data: searchProfiles } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .or(`email.ilike.%${req.query.user_search}%,name.ilike.%${req.query.user_search}%`);
            
            if (searchProfiles && searchProfiles.length > 0) {
                const ids = searchProfiles.map(p => p.id);
                summaryQuery = summaryQuery.in('user_id', ids);
            } else {
                summaryQuery = summaryQuery.eq('user_id', '00000000-0000-0000-0000-000000000000'); // Force 0 results
            }
        }

        const { data: allTx } = await summaryQuery;

        const summary = (allTx || []).reduce((acc, tx) => {
            if (tx.type === 'CREDIT') {
                acc.total_credit += Number(tx.amount || 0);
            }
            if (tx.type === 'DEBIT') {
                acc.total_debit += Number(tx.amount || 0);
            }

            if (tx.type === 'CREDIT' && tx.source === 'ADMIN_TOPUP') {
                acc.total_distributed += Number(tx.amount || 0);
            }
            if (tx.type === 'DEBIT' && tx.source?.endsWith('SEND')) {
                acc.total_consumed += Number(tx.amount || 0);
            }
            if (tx.type === 'CREDIT' && tx.source === 'RECHARGE') {
                acc.total_agency_recharge += Number(tx.amount || 0);
            }
            
            if (tx.type === 'DEBIT') {
                acc.total_meta_cost += Number(tx.meta_cost || 0);
                acc.total_platform_cost += Number(tx.platform_cost || 0);
            }
            return acc;
        }, {
            total_distributed: 0,
            total_consumed: 0,
            total_meta_cost: 0,
            total_platform_cost: 0,
            total_agency_recharge: 0,
            total_credit: 0,
            total_debit: 0
        });

        // Also fetch Master Wallet Balance if applicable
        let masterWalletBalance = null;
        if (!isSuperAdmin) {
            const adminUserId = req.admin?.user_id || req.admin?.id;
            if (adminUserId) {
                const { data: mw } = await supabaseAdmin.from('user_wallets').select('balance').eq('user_id', adminUserId).eq('is_tenant_master', true).maybeSingle();
                if (mw) masterWalletBalance = Number(mw.balance || 0);
            }
        }

        res.json({ data, total: count || 0, page, limit, summary, masterWalletBalance });
    } catch (error) {
        console.error('Error fetching domain ledger:', error);
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
            .select('balance');

        summary.total_wallets = wallets?.length || 0;
        summary.total_balance_in_system = wallets?.reduce((s, w) => s + Number(w.balance || 0), 0) || 0;

        res.json(summary);
    } catch (error) {
        console.error('Error fetching summary:', error);
        res.status(500).json({ error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/wallet/admin/topup — Smart billing-mode-aware top-up
//
// Routing Logic:
//   - Super Admin            → always allowed, direct ADMIN_TOPUP credit
//   - Tenant Admin + CREDIT_LINE_SUPER user → must use Reseller Transfer
//                              (deducts from Tenant's Master Wallet)
//   - Tenant Admin + CREDIT_LINE_TENANT/DIRECT_META → only if Super Admin
//     has granted allow_tenant_billing_control AND domain has own Meta App
// ═══════════════════════════════════════════════════════════════════════════
router.post('/topup', async (req, res) => {
    try {
        const { userId, targetUserId, amount, description, wallet_enforced, billing_mode, reset_debt } = req.body;
        const uid = userId || targetUserId;

        if (!uid || amount === undefined) {
            return res.status(400).json({ error: 'User ID and Amount are required' });
        }

        // ── Determine who is calling (Super Admin vs Tenant Admin) ──────────
        const adminDomain   = req.admin?.managed_domain || req.admin?.domain;
        const adminRole     = req.admin?.role;
        const adminUserId   = req.admin?.user_id || req.admin?.id;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL
            ? new URL(process.env.VITE_MASTER_URL).hostname
            : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin';

        // ── Domain Authority Check & Target Domain Extraction ───────────────────
        const { data: targetProfile } = await supabaseAdmin
            .from('profiles')
            .select('signup_domain')
            .eq('id', uid)
            .maybeSingle();

        const targetDomain = targetProfile?.signup_domain || adminDomain;

        if (!isSuperAdmin) {
            if (!targetProfile || targetProfile.signup_domain !== adminDomain) {
                return res.status(403).json({
                    error: 'Forbidden: You can only manage wallets for users on your domain.'
                });
            }
        }

        // ── Fetch target user's current wallet ──────────────────────────────
        const targetWallet = await WalletService.getWallet(uid);
        let effectiveBillingMode = billing_mode || targetWallet.billing_mode || 'DIRECT_META';

        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 SECURITY: STRICT DOMAIN ISOLATION ENFORCEMENT
        //
        // Enforce the rule: "For each tenant domain, only one wallet credit source
        // should be active at a time." This blocks API abuse where a user could
        // be assigned a billing mode that contradicts their domain configuration.
        // ═══════════════════════════════════════════════════════════════════════
        
        // Always fetch domain settings to enforce isolation rules
        const { data: domainSettings } = await supabaseAdmin
            .from('domain_wallet_settings')
            .select('allow_tenant_billing_control, default_billing_mode, allowed_credit_currencies')
            .eq('domain', targetDomain)
            .maybeSingle();
            
        const domainDefaultMode = domainSettings?.default_billing_mode || 'DIRECT_META';

        if (billing_mode && billing_mode !== targetWallet.billing_mode) {
            // Strict Matrix Validation
            if (domainDefaultMode === 'CREDIT_LINE_TENANT' && billing_mode === 'CREDIT_LINE_SUPER') {
                return res.status(400).json({ error: 'Domain is configured for Tenant Credit Line. Super Admin Credit Line cannot be assigned to users in this domain.' });
            }
            if (domainDefaultMode === 'CREDIT_LINE_SUPER' && billing_mode === 'CREDIT_LINE_TENANT') {
                return res.status(400).json({ error: 'Domain is configured for Super Admin Credit Line. Tenant Credit Line cannot be assigned to users in this domain.' });
            }
            if (domainDefaultMode === 'DIRECT_META' && (billing_mode === 'CREDIT_LINE_SUPER' || billing_mode === 'CREDIT_LINE_TENANT')) {
                return res.status(400).json({ error: 'Domain is configured for Direct Meta Pay only. Credit Lines cannot be assigned to users in this domain.' });
            }
        }

        // ═══════════════════════════════════════════════════════════════════════
        // 🔒 SECURITY: Billing Mode Change Authority Validation
        //
        // A Tenant Admin CANNOT switch a user to CREDIT_LINE_TENANT or DIRECT_META
        // unless BOTH conditions are true:
        //   1. Super Admin granted allow_tenant_billing_control = TRUE for this domain
        //   2. The domain has its OWN Meta App ID (not using Super Admin's app)
        //
        // Attack vector blocked: A Tenant Admin could set CREDIT_LINE_TENANT to give
        // unlimited free credits to users, and the Meta bill would still come to the
        // Super Admin (since messages go through Super Admin's WhatsApp App).
        // ═══════════════════════════════════════════════════════════════════════
        if (!isSuperAdmin && billing_mode && billing_mode !== targetWallet.billing_mode) {
            const isEscalating = billing_mode === 'CREDIT_LINE_TENANT' || billing_mode === 'DIRECT_META';

            if (isEscalating) {
                // Layer 1: Check Super Admin permission flag ──────────────────
                const isAllowed = domainSettings?.allow_tenant_billing_control === true;
                if (!isAllowed) {
                    console.warn(`[WalletAdmin] 🚨 BLOCKED billing_mode escalation: Tenant ${adminUserId} → ${billing_mode} on ${adminDomain} (not permitted by Super Admin)`);
                    return res.status(403).json({
                        error: 'Forbidden: You are not authorized to change the billing mode. Only the Super Admin can unlock this. Contact the Super Admin to enable Tenant Billing Control for your domain.'
                    });
                }

                // Layer 2: Verify domain has its OWN Meta App ─────────────
                // If the domain uses the Super Admin's WhatsApp App,
                // then CREDIT_LINE_TENANT/DIRECT_META would expose Super Admin to unlimited liability.
                const { data: domainUsers } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('signup_domain', adminDomain)
                    .limit(50);

                const domainUserIds = (domainUsers || []).map(u => u.id);
                let hasDomainOwnApp = false;

                if (domainUserIds.length > 0) {
                    const { data: metaApp } = await supabaseAdmin
                        .from('whatsapp_config')
                        .select('meta_app_id')
                        .in('user_id', domainUserIds)
                        .not('meta_app_id', 'is', null)
                        .limit(1)
                        .maybeSingle();

                    hasDomainOwnApp = !!metaApp?.meta_app_id;
                }

                if (!hasDomainOwnApp) {
                    console.warn(`[WalletAdmin] 🚨 BLOCKED billing_mode escalation: Domain ${adminDomain} has no own Meta App — still using Super Admin's credit line.`);
                    return res.status(403).json({
                        error: `Forbidden: Billing mode "${billing_mode === 'CREDIT_LINE_TENANT' ? 'Tenant Agency Credit Line' : 'Direct Meta Billing'}" requires your domain to have its own dedicated Meta Business App configured. Without this, all messages are charged to the Super Admin's Meta account. Please contact the Super Admin to configure a dedicated Meta App for your domain.`
                    });
                }

                // Layer 3: Check WABA Currency against Super Admin's allowed currencies ──
                const allowedCurrencies = domainSettings?.allowed_credit_currencies || ['INR'];
                const { data: wabaConfig } = await supabaseAdmin
                    .from('whatsapp_config')
                    .select('currency, meta_access_token, whatsapp_business_account_id')
                    .eq('user_id', uid)
                    .limit(1)
                    .maybeSingle();
                    
                let wabaCurrency = wabaConfig?.currency;

                // Dynamically fetch from Meta if currency is missing (for older users before the update)
                if (!wabaCurrency && wabaConfig?.meta_access_token && wabaConfig?.whatsapp_business_account_id) {
                    try {
                        console.log(`[WalletAdmin] Currency missing for user ${uid}. Fetching from Meta...`);
                        const currencyRes = await axios.get(`https://graph.facebook.com/v20.0/${wabaConfig.whatsapp_business_account_id}?fields=currency`, {
                            headers: { 'Authorization': `Bearer ${wabaConfig.meta_access_token}` }
                        });
                        if (currencyRes.data && currencyRes.data.currency) {
                            wabaCurrency = currencyRes.data.currency;
                            console.log(`[WalletAdmin] Fetched currency ${wabaCurrency} for ${wabaConfig.whatsapp_business_account_id}`);
                            // Save it back to database
                            await supabaseAdmin
                                .from('whatsapp_config')
                                .update({ currency: wabaCurrency })
                                .eq('user_id', uid);
                        }
                    } catch (currencyErr) {
                        console.error('[WalletAdmin] Failed to fetch currency dynamically:', currencyErr.message);
                    }
                }

                // Fallback if still missing or fetch failed
                if (!wabaCurrency) wabaCurrency = 'INR';

                if (!allowedCurrencies.includes(wabaCurrency)) {
                    console.warn(`[WalletAdmin] 🚨 BLOCKED billing_mode escalation: Tenant ${adminUserId} tried to assign ${billing_mode} to user ${uid} with restricted currency ${wabaCurrency}`);
                    return res.status(403).json({
                        error: `Forbidden: This user has a ${wabaCurrency} WABA. Super Admin only allows Wallet access for ${allowedCurrencies.join(', ')} WABAs. This user must use DIRECT_META billing mode.`
                    });
                }

                console.log(`[WalletAdmin] ✅ Billing mode escalation APPROVED: Tenant ${adminUserId} changed user ${uid} to ${billing_mode} on ${adminDomain}`);
            }
        }

        let result = null;

        if (Number(amount) > 0) {
            if (!isSuperAdmin && effectiveBillingMode === 'CREDIT_LINE_SUPER') {
                // ── Reseller Transfer: Deduct from Tenant Admin Master Wallet ──
                if (!adminUserId) {
                    return res.status(403).json({ error: 'Tenant Admin user ID not found in token.' });
                }

                const rawAdminId = req.admin?.user_id || req.admin?.id;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                const validAdminId = rawAdminId && uuidRegex.test(rawAdminId) ? rawAdminId : null;

                const { data: transferResult, error: transferError } = await supabaseAdmin
                    .rpc('transfer_reseller_balance', {
                        p_tenant_admin_user_id: adminUserId,
                        p_target_user_id: uid,
                        p_amount: Number(amount),
                        p_description: description || 'Reseller top-up from Agency',
                        p_created_by: validAdminId,
                        p_ip_address: req.ip
                    });

                if (transferError) {
                    const errMsg = transferError.message || '';
                    if (errMsg.includes('INSUFFICIENT_AGENCY_BALANCE')) {
                        return res.status(402).json({
                            error: 'Insufficient Agency Balance. Please contact the Super Admin to recharge your Master Wallet.'
                        });
                    }
                    if (errMsg.includes('MASTER_WALLET_NOT_FOUND')) {
                        return res.status(404).json({
                            error: 'Your Agency Master Wallet has not been set up. Please contact the Super Admin.'
                        });
                    }
                    throw transferError;
                }
                result = transferResult;
                console.log(`[WalletAdmin] Reseller transfer: ₹${amount} from Tenant ${adminUserId} → User ${uid}`);

            } else {
                // ── Direct Credit (Super Admin or non-SUPER modes) ──────────
                const rawAdminId = req.admin?.user_id || req.admin?.id;
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                const validAdminId = rawAdminId && uuidRegex.test(rawAdminId) ? rawAdminId : null;

                result = await WalletService.addCredit(
                    uid, Number(amount), 'ADMIN_TOPUP', description || 'Admin top-up',
                    validAdminId, req.ip
                );
                console.log(`[WalletAdmin] Direct top-up: ₹${amount} → User ${uid} (mode: ${effectiveBillingMode})`);
            }
        }

        // ── Direct Meta Tracking Debt Forgiveness ─────────────────────
        if (reset_debt === true && targetWallet.balance < 0 && targetWallet.billing_mode === 'DIRECT_META') {
            const debtAmount = Math.abs(Number(targetWallet.balance));
            await WalletService.addCredit(
                uid, debtAmount, 'DEBT_FORGIVENESS', 'System Adjustment: Resetting Direct Meta tracking debt to 0',
                null, req.ip
            );
            console.log(`[WalletAdmin] Forgave tracking debt of ₹${debtAmount} for User ${uid}`);
        }

        // ── Update wallet settings (billing mode only) ─────────────────────
        const walletUpdates = {};
        // NOTE: Force strict mode to always be enabled (cannot be disabled by any admin)
        walletUpdates.wallet_enforced = true;
        if (billing_mode !== undefined) walletUpdates.billing_mode = billing_mode;
        if (Object.keys(walletUpdates).length > 0) {
            await supabaseAdmin.from('user_wallets').update(walletUpdates).eq('user_id', uid);
        }

        res.json({ success: true, transaction: result, billing_mode: effectiveBillingMode });
    } catch (error) {
        console.error('Error topping up wallet:', error);
        res.status(500).json({ error: error.message });
    }
});


// ── Tenant Admin: top-up their OWN Master Wallet ─────────────────────────
// POST /api/wallet/admin/topup-master — Super Admin gives wholesale credits to a Tenant Admin
router.post('/topup-master', async (req, res) => {
    try {
        // 🔒 SECURITY: Only Super Admin can top-up a Master Wallet
        const adminDomain   = req.admin?.managed_domain || req.admin?.domain;
        const adminRole     = req.admin?.role;
        const MASTER_DOMAIN = process.env.VITE_MASTER_URL
            ? new URL(process.env.VITE_MASTER_URL).hostname
            : 'clickube.com';
        const isSuperAdmin = adminRole === 'super_admin';

        if (!isSuperAdmin) {
            console.warn(`[WalletAdmin] 🚨 BLOCKED: Unauthorized attempt to top-up Master Wallet by ${req.admin?.id}`);
            return res.status(403).json({ error: 'Forbidden: Only Super Admins can recharge a Master Wallet.' });
        }

        const { tenantAdminUserId, domain, amount, description } = req.body;
        if ((!tenantAdminUserId && !domain) || !amount) {
            return res.status(400).json({ error: 'tenantAdminUserId or domain, and amount required' });
        }

        let targetUserId = tenantAdminUserId;

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!targetUserId || !uuidRegex.test(targetUserId)) {
            if (!domain) {
                return res.status(400).json({ error: 'Invalid user ID and no domain provided.' });
            }
            const { data: adminProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', domain)
                .eq('role', 'admin')
                .maybeSingle();
                
            if (!adminProfile) {
                return res.status(404).json({ error: 'Tenant Admin has not signed up yet for this domain. Please ask them to register first before recharging their Agency Wallet.' });
            }
            targetUserId = adminProfile.id;
        }

        // Ensure the Tenant Admin Master Wallet row exists
        const { error: initError } = await supabaseAdmin
            .rpc('ensure_tenant_master_wallet', { p_tenant_admin_user_id: targetUserId });
        if (initError) throw initError;

        // Credit the Master Wallet directly (Super Admin creates money from thin air here)
        // Validate that req.admin.user_id / req.admin.id is a valid UUID, otherwise pass null
        const rawAdminId = req.admin?.user_id || req.admin?.id;
        const validAdminId = rawAdminId && uuidRegex.test(rawAdminId) ? rawAdminId : null;

        const result = await WalletService.addCredit(
            targetUserId, Number(amount), 'ADMIN_TOPUP',
            description || 'Super Admin wholesale credit to Agency Master Wallet',
            validAdminId,
            req.ip
        );
        res.json({ success: true, transaction: result });
    } catch (error) {
        console.error('Error topping up master wallet:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/master-balance — Tenant Admin checks their own Master Wallet
router.get('/master-balance', async (req, res) => {
    try {
        const adminUserId = req.admin?.user_id || req.admin?.id;
        if (!adminUserId) return res.status(403).json({ error: 'Admin user ID not found in token' });

        const { data: masterWallet } = await supabaseAdmin
            .from('user_wallets')
            .select('balance, updated_at')
            .eq('user_id', adminUserId)
            .eq('is_tenant_master', true)
            .maybeSingle();

        res.json({
            balance: masterWallet?.balance || 0,
            updated_at: masterWallet?.updated_at || null
        });
    } catch (error) {
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
            await WalletService.addCredit(
                userId, adjustmentAmount, 'ADJUSTMENT', 'Admin manual balance reset to 0',
                req.admin?.user_id || req.admin?.id, req.ip
            );
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
        const userId = req.params.userId;
        
        const adminUserId = req.admin?.user_id || req.admin?.id;
        const isSuperAdmin = req.admin?.role === 'super_admin';

        // 1. Fetch user's WABA currency
        const { data: wabaConfig } = await supabaseAdmin
            .from('whatsapp_config')
            .select('currency')
            .eq('user_id', userId)
            .maybeSingle();
            
        const currency = wabaConfig?.currency || 'INR';

        // 2. Fetch baseline global rates
        const { data: globalRates, error: gError } = await supabaseAdmin
            .from('wa_message_rates')
            .select('*')
            .eq('scope', 'GLOBAL')
            .eq('currency', currency)
            .eq('is_active', true);
            
        if (gError) throw gError;

        let baselineRates = [];
        if (isSuperAdmin) {
             baselineRates = globalRates.map(r => {
                 // Ensure we never suggest a rate lower than meta cost
                 if (r.platform_rate === 0 || r.platform_rate < r.meta_cost) {
                     return { ...r, platform_rate: r.meta_cost > 0 ? r.meta_cost : 0.0001 };
                 }
                 return r;
             });
        } else {
             // For Tenant admins, their baseline is their own effective rate
             const { data: tenantRates } = await supabaseAdmin
                 .from('wa_message_rates')
                 .select('*')
                 .in('scope', ['TENANT', 'WORKSPACE'])
                 .eq('user_id', adminUserId)
                 .eq('currency', currency)
                 .eq('is_active', true);
                 
             const baselineMap = {};
             (globalRates || []).forEach(gr => {
                 baselineMap[`${gr.category}_${gr.country_code}`] = { ...gr };
             });
             
             (tenantRates || []).forEach(tr => {
                 const key = `${tr.category}_${tr.country_code}`;
                 if (baselineMap[key]) {
                     // Tenant's rate overrides global rate for their cost floor
                     baselineMap[key].platform_rate = tr.platform_rate;
                     baselineMap[key].meta_cost = tr.meta_cost;
                 }
             });
             
             baselineRates = Object.values(baselineMap).map(r => {
                 // Enforce meta cost floor to prevent losses
                 if (r.platform_rate === 0 || r.platform_rate < r.meta_cost) {
                     return { ...r, platform_rate: r.meta_cost > 0 ? r.meta_cost : 0.0001 };
                 }
                 return r;
             });
        }
        
        // Ensure baselineRates are marked as 'GLOBAL' so the UI uses them as defaults
        baselineRates = baselineRates.map(r => ({ ...r, scope: 'GLOBAL', id: undefined, user_id: null }));

        // 3. Fetch the target user's WORKSPACE overrides
        const { data: userRates, error: uError } = await supabaseAdmin
            .from('wa_message_rates')
            .select('*')
            .eq('scope', 'WORKSPACE')
            .eq('user_id', userId)
            .eq('currency', currency)
            .eq('is_active', true);
            
        if (uError) throw uError;

        res.json([...baselineRates, ...(userRates || [])]);
    } catch (error) {
        console.error('Error fetching rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/rates — set custom rates
router.post('/rates', async (req, res) => {
    try {
        const { userId, rates, scope } = req.body;
        
        if (!userId || !rates || !Array.isArray(rates)) {
            return res.status(400).json({ error: 'User ID and rates array are required' });
        }

        // 1. Fetch user's WABA currency
        const { data: wabaConfig } = await supabaseAdmin
            .from('whatsapp_config')
            .select('currency')
            .eq('user_id', userId)
            .maybeSingle();
            
        const currency = wabaConfig?.currency || 'INR';

        // Fetch global rates to enforce cost floor for that specific currency
        const { data: globalRates } = await supabaseAdmin
            .from('wa_message_rates')
            .select('category, country_code, meta_cost, platform_rate')
            .eq('scope', 'GLOBAL')
            .eq('currency', currency)
            .is('user_id', null);

        const isSuperAdmin = req.admin?.role === 'super_admin';
        const adminUserId = req.admin?.user_id || req.admin?.id;

        const upserts = [];
        const toDelete = [];

        await Promise.all(rates.map(async r => {
            const countryCode = r.country_code || 'IN';
            
            if (r.platform_rate === '' || r.platform_rate === null || r.platform_rate === undefined) {
                toDelete.push({
                    scope: r.scope || scope || 'WORKSPACE',
                    category: r.category,
                    country_code: countryCode
                });
                return;
            }

            let costFloor = 0;

            if (isSuperAdmin) {
                // Super admins can set any rate down to the raw Meta cost.
                const gr = globalRates?.find(g => g.category === r.category && g.country_code === countryCode);
                costFloor = gr ? Number(gr.meta_cost) : 0;
            } else {
                // Regular admins (Tenants) cannot set a rate below the actual rate they are paying
                try {
                    const tenantRate = await WalletService.getRate(adminUserId, r.category, countryCode);
                    costFloor = Math.max(Number(tenantRate.platform_rate), Number(tenantRate.meta_cost));
                } catch (e) {
                    // Fallback to global rate if getRate fails
                    const gr = globalRates?.find(g => g.category === r.category && g.country_code === countryCode);
                    costFloor = gr ? Math.max(Number(gr.platform_rate), Number(gr.meta_cost)) : 0;
                }
            }

            // Cost floor enforcement (also protect against 0 values)
            const absoluteMin = costFloor > 0 ? costFloor : 0.0001;
            if (Number(r.platform_rate) < absoluteMin) {
                throw new Error(`Rate for ${r.category} (${countryCode}) cannot be below your assigned cost floor of ${absoluteMin}`);
            }

            // We must still pass the true meta_cost down for billing records
            const rawMetaCost = globalRates?.find(g => g.category === r.category && g.country_code === countryCode)?.meta_cost || r.meta_cost || 0;

            upserts.push({
                scope: r.scope || scope || 'WORKSPACE', // Use rate-specific scope, fallback to body scope, then 'WORKSPACE'
                user_id: userId,
                category: r.category,
                country_code: countryCode,
                meta_cost: rawMetaCost,
                platform_rate: r.platform_rate,
                currency: currency,
                updated_by: null
            });
        }));
        
        // Workaround for Postgres unique constraints with nulls:
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
        
        for (const d of toDelete) {
            let deleteQuery = supabaseAdmin
                .from('wa_message_rates')
                .delete()
                .eq('scope', d.scope)
                .eq('category', d.category)
                .eq('country_code', d.country_code)
                .eq('currency', currency);

            if (userId) {
                deleteQuery = deleteQuery.eq('user_id', userId);
            } else {
                deleteQuery = deleteQuery.is('user_id', null);
            }

            const { error: deleteError } = await deleteQuery;
            if (deleteError) throw deleteError;
        }

        if (upserts.length > 0) {
            const { error } = await supabaseAdmin
                .from('wa_message_rates')
                .insert(upserts);
                
            if (error) throw error;
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting rates:', error);
        res.status(400).json({ error: error.message });
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
        
        for (const r of upserts) {
            await supabaseAdmin
                .from('wa_message_rates')
                .delete()
                .eq('scope', 'GLOBAL')
                .eq('category', r.category)
                .eq('country_code', r.country_code)
                .eq('currency', r.currency)
                .is('user_id', null);
        }

        const { error } = await supabaseAdmin
            .from('wa_message_rates')
            .insert(upserts);
            
        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error setting global rates:', error);
        res.status(500).json({ error: error.message });
    }
});

// ── Domain Wallet Settings (Super Admin only) ─────────────────────────────
// GET /api/wallet/admin/domain-admins/:domain
router.get('/domain-admins/:domain', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, name, email')
            .eq('signup_domain', req.params.domain)
            .eq('role', 'admin');
            
        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/admin/domain-settings/:domain
router.get('/domain-settings/:domain', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('domain_wallet_settings')
            .select('*')
            .eq('domain', req.params.domain)
            .maybeSingle();
        if (error) throw error;
        res.json(data || { domain: req.params.domain, default_billing_mode: 'DIRECT_META', allow_tenant_billing_control: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/domain-settings — update domain wallet settings
router.post('/domain-settings', async (req, res) => {
    try {
        const { domain, default_billing_mode, tenant_admin_user_id, allow_tenant_billing_control, allowed_credit_currencies } = req.body;
        if (!domain) return res.status(400).json({ error: 'domain is required' });

        let actualTenantAdminUserId = tenant_admin_user_id;

        // If the frontend passes an invalid UUID (like "admin-cloudospire.in") or omits it,
        // we automatically look up the correct Tenant Admin UUID for this domain.
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!actualTenantAdminUserId || !uuidRegex.test(actualTenantAdminUserId)) {
            const { data: adminProfile } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', domain)
                .eq('role', 'admin')
                .maybeSingle();
                
            actualTenantAdminUserId = adminProfile ? adminProfile.id : null;
        }

        const upsertData = {
            domain,
            default_billing_mode: default_billing_mode || 'DIRECT_META',
            allow_tenant_billing_control: allow_tenant_billing_control !== undefined ? allow_tenant_billing_control : true,
            allowed_credit_currencies: allowed_credit_currencies && allowed_credit_currencies.length > 0 ? allowed_credit_currencies : ['INR'],
            updated_at: new Date().toISOString()
        };
        if (actualTenantAdminUserId) upsertData.tenant_admin_user_id = actualTenantAdminUserId;

        const { error } = await supabaseAdmin
            .from('domain_wallet_settings')
            .upsert(upsertData, { onConflict: 'domain' });
        if (error) throw error;

        // If a tenant admin is set, ensure their Master Wallet exists
        if (actualTenantAdminUserId) {
            await supabaseAdmin.rpc('ensure_tenant_master_wallet', {
                p_tenant_admin_user_id: actualTenantAdminUserId
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
