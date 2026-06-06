const express = require('express');
const router = express.Router();
const WalletService = require('../../services/WalletService');
const { supabaseAdmin } = require('../../lib/supabaseClient');

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
                wallet.default_billing_mode = 'CREDIT_LINE_SUPER';
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
        const { userId, targetUserId, amount, description, wallet_enforced, billing_mode } = req.body;
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
        const isSuperAdmin = adminRole === 'super_admin' ||
            adminDomain === MASTER_DOMAIN ||
            adminDomain === 'localhost';

        // ── Domain Authority Check ──────────────────────────────────────────
        if (!isSuperAdmin) {
            const { data: targetProfile } = await supabaseAdmin
                .from('profiles')
                .select('signup_domain')
                .eq('id', uid)
                .maybeSingle();

            if (!targetProfile || targetProfile.signup_domain !== adminDomain) {
                return res.status(403).json({
                    error: 'Forbidden: You can only manage wallets for users on your domain.'
                });
            }
        }

        // ── Fetch target user's current wallet ──────────────────────────────
        const targetWallet = await WalletService.getWallet(uid);
        let effectiveBillingMode = billing_mode || targetWallet.billing_mode || 'CREDIT_LINE_SUPER';

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
                const { data: domainSettings } = await supabaseAdmin
                    .from('domain_wallet_settings')
                    .select('allow_tenant_billing_control')
                    .eq('domain', adminDomain)
                    .maybeSingle();

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

                const { data: transferResult, error: transferError } = await supabaseAdmin
                    .rpc('transfer_reseller_balance', {
                        p_tenant_admin_user_id: adminUserId,
                        p_target_user_id: uid,
                        p_amount: Number(amount),
                        p_description: description || 'Reseller top-up from Agency',
                        p_created_by: req.admin?.user_id || req.admin?.id,
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
                result = await WalletService.addCredit(
                    uid, Number(amount), 'ADMIN_TOPUP', description || 'Admin top-up',
                    req.admin?.user_id || req.admin?.id, req.ip
                );
                console.log(`[WalletAdmin] Direct top-up: ₹${amount} → User ${uid} (mode: ${effectiveBillingMode})`);
            }
        }

        // ── Update wallet settings (enforcement + billing mode) ─────────────
        const walletUpdates = {};
        if (wallet_enforced !== undefined) walletUpdates.wallet_enforced = wallet_enforced;
        if (billing_mode    !== undefined) walletUpdates.billing_mode    = billing_mode;
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
        const isSuperAdmin = adminRole === 'super_admin' ||
            adminDomain === MASTER_DOMAIN ||
            adminDomain === 'localhost';

        if (!isSuperAdmin) {
            console.warn(`[WalletAdmin] 🚨 BLOCKED: Unauthorized attempt to top-up Master Wallet by ${req.admin?.id}`);
            return res.status(403).json({ error: 'Forbidden: Only Super Admins can recharge a Master Wallet.' });
        }

        const { tenantAdminUserId, domain, amount, description } = req.body;
        if ((!tenantAdminUserId && !domain) || !amount) {
            return res.status(400).json({ error: 'tenantAdminUserId or domain, and amount required' });
        }

        let targetUserId = tenantAdminUserId;

        // If domain is provided, find the tenant admin user ID
        if (!targetUserId && domain) {
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
        const result = await WalletService.addCredit(
            targetUserId, Number(amount), 'ADMIN_TOPUP',
            description || 'Super Admin wholesale credit to Agency Master Wallet',
            req.admin?.user_id || req.admin?.id,
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
        const { userId, rates, scope } = req.body;
        
        if (!userId || !rates || !Array.isArray(rates)) {
            return res.status(400).json({ error: 'User ID and rates array are required' });
        }

        // Fetch global rates to enforce cost floor
        const { data: globalRates } = await supabaseAdmin
            .from('wa_message_rates')
            .select('category, country_code, meta_cost')
            .eq('scope', 'GLOBAL')
            .is('user_id', null);

        const getGlobalMetaCost = (cat, cc) => {
            const gr = globalRates?.find(g => g.category === cat && g.country_code === cc);
            return gr ? Number(gr.meta_cost) : 0;
        };
        
        const upserts = rates.map(r => {
            const countryCode = r.country_code || 'IN';
            const metaCostFloor = getGlobalMetaCost(r.category, countryCode) || r.meta_cost || 0;

            if (Number(r.platform_rate) < metaCostFloor) {
                throw new Error(`Rate for ${r.category} (${countryCode}) cannot be below the cost floor of ${metaCostFloor}`);
            }

            return {
                scope: scope || 'USER', // Allow frontend to specify TENANT or USER
                user_id: userId,
                category: r.category,
                country_code: countryCode,
                meta_cost: metaCostFloor,
                platform_rate: r.platform_rate,
                currency: 'INR',
                updated_by: null
            };
        });
        
        const { error } = await supabaseAdmin
            .from('wa_message_rates')
            .upsert(upserts, { onConflict: 'scope,user_id,category,country_code' });
            
        if (error) throw error;
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

// ── Domain Wallet Settings (Super Admin only) ─────────────────────────────
// GET /api/wallet/admin/domain-settings/:domain
router.get('/domain-settings/:domain', async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('domain_wallet_settings')
            .select('*')
            .eq('domain', req.params.domain)
            .maybeSingle();
        if (error) throw error;
        res.json(data || { domain: req.params.domain, default_billing_mode: 'CREDIT_LINE_SUPER', allow_tenant_billing_control: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/admin/domain-settings — update domain wallet settings
router.post('/domain-settings', async (req, res) => {
    try {
        const { domain, default_billing_mode, tenant_admin_user_id, allow_tenant_billing_control } = req.body;
        if (!domain) return res.status(400).json({ error: 'domain is required' });

        const upsertData = {
            domain,
            default_billing_mode: default_billing_mode || 'CREDIT_LINE_SUPER',
            allow_tenant_billing_control: allow_tenant_billing_control !== undefined ? allow_tenant_billing_control : true,
            updated_at: new Date().toISOString()
        };
        if (tenant_admin_user_id) upsertData.tenant_admin_user_id = tenant_admin_user_id;

        const { error } = await supabaseAdmin
            .from('domain_wallet_settings')
            .upsert(upsertData, { onConflict: 'domain' });
        if (error) throw error;

        // If a tenant admin is set, ensure their Master Wallet exists
        if (tenant_admin_user_id) {
            await supabaseAdmin.rpc('ensure_tenant_master_wallet', {
                p_tenant_admin_user_id: tenant_admin_user_id
            });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
