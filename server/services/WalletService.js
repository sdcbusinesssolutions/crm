const { supabaseAdmin } = require('../lib/supabaseClient');
const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { logWalletEvent } = require('../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP BILLING MODEL (Meta Cloud API) - V2 Architecture (Optimized)
// ─────────────────────────────────────────────────────────────────────────────

const rateCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const roundMoney = (val) => Math.round(Number(val) * 10000) / 10000;

// In-Memory RAM Lock to prevent DB connection spam from duplicate webhooks
const activeWebhookLocks = new Set();

class WalletService {

    /**
     * Get user's wallet. Creates one if it doesn't exist.
     */
    static async getWallet(userId) {
        let { data: wallet, error } = await supabaseAdmin
            .from('user_wallets')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw error;

        if (!wallet) {
            const { data: newWallet, error: createError } = await supabaseAdmin
                .from('user_wallets')
                .insert({ user_id: userId })
                .select('*')
                .single();
            if (createError) throw createError;
            wallet = newWallet;
        }
        return wallet;
    }

    /**
     * Parse phone number to extract ISO-2 Country Code (e.g., 'IN', 'US', 'GB')
     */
    static getCountryCode(phone) {
        if (!phone) return 'IN';
        try {
            const formatted = phone.startsWith('+') ? phone : '+' + phone;
            const parsed = parsePhoneNumberFromString(formatted);
            return parsed ? parsed.country || 'IN' : 'IN';
        } catch (e) {
            return 'IN';
        }
    }

    /**
     * Get effective rate for a user + category (Optimized with Cache & Single Query).
     * Lookup Priority: USER override → TENANT/WORKSPACE override → GLOBAL default → fallback
     */
    static async getRate(userId, category, countryCode = 'IN', tenantId = null) {
        category = (category || 'MARKETING').toUpperCase();

        let actualTenantId = tenantId;
        if (!actualTenantId) {
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('tenant_id')
                    .eq('id', userId)
                    .maybeSingle();
                actualTenantId = profile?.tenant_id || null;
            } catch (e) {
                // Ignore
            }
        }

        const targetTenantId = actualTenantId || userId;

        // 1. Fetch user's wallet to know their currency (INR vs USD)
        const wallet = await this.getWallet(userId);
        const currency = wallet.currency || 'INR';

        const cacheKey = `${userId}_${actualTenantId || 'null'}_${category}_${countryCode}_${currency}`;

        const cached = rateCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.rate;
        }

        // 2. Single query fetching all possible hierarchies, strictly filtered by CURRENCY
        const { data: rates } = await supabaseAdmin
            .from('wa_message_rates')
            .select('scope, user_id, platform_rate, meta_cost, currency')
            .eq('category', category)
            .eq('country_code', countryCode)
            .eq('currency', currency)
            .eq('is_active', true)
            .or(`user_id.eq.${userId},user_id.eq.${targetTenantId},scope.eq.GLOBAL`);

        let selectedRate = null;

        if (rates && rates.length > 0) {
            const userRate = rates.find(r => r.scope === 'USER' && r.user_id === userId);
            const workspaceRate = rates.find(r => r.scope === 'WORKSPACE' && r.user_id === userId);
            const tenantRate = actualTenantId ? rates.find(r => ['TENANT', 'WORKSPACE'].includes(r.scope) && r.user_id === actualTenantId) : null;
            const globalRate = rates.find(r => r.scope === 'GLOBAL');

            selectedRate = userRate || workspaceRate || tenantRate || globalRate;
        }

        if (!selectedRate) {
            throw new Error(`Sending to country code ${countryCode} is not allowed by the platform. Please contact support.`);
        }

        // ENFORCE META COST FLOOR TO PREVENT LOSSES
        // Even if a bug or Super Admin sets the platform_rate to 0, we must never charge the user less than the cost we pay Meta!
        if (selectedRate.platform_rate === 0 || selectedRate.platform_rate < selectedRate.meta_cost) {
            console.warn(`[WalletService] ⚠️ Rate enforcement triggered for ${userId} (${category}). Original rate: ${selectedRate.platform_rate}, Meta cost: ${selectedRate.meta_cost}. Floor enforced.`);
            selectedRate.platform_rate = selectedRate.meta_cost > 0 ? selectedRate.meta_cost : 0.0001;
        }

        rateCache.set(cacheKey, { rate: selectedRate, expiresAt: Date.now() + CACHE_TTL_MS });
        return selectedRate;
    }

    /**
     * BALANCE CHECK
     */
    static async hasSufficientBalance(userId, overrideAmount = null, expectedCategory = 'MARKETING') {
        try {
            const wallet = await this.getWallet(userId);

            // 1. STRICT LOCK CHECK: Is wallet frozen?
            if (wallet.wallet_frozen) {
                console.warn(`[WalletService] 🚫 Blocked: Wallet is frozen for user ${userId}`);
                return false;
            }

            // 2. STRICT BAN & EXPIRED CHECK: Is user profile suspended, banned, or expired?
            try {
                const { data: profile } = await supabaseAdmin
                    .from('profiles')
                    .select('plan_status, plan_expires_at')
                    .eq('id', userId)
                    .maybeSingle();

                if (profile) {
                    // Block on negative statuses
                    if (['suspended', 'banned', 'expired', 'past_due', 'canceled'].includes(profile.plan_status)) {
                        console.warn(`[WalletService] 🚫 Blocked: Profile status is '${profile.plan_status}' for user ${userId}`);
                        return false;
                    }

                    // Block if the physical expiration date has passed
                    if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
                        console.warn(`[WalletService] 🚫 Blocked: Profile plan expired on ${profile.plan_expires_at} for user ${userId}`);
                        return false;
                    }
                }
            } catch (err) {
                // Ignore DB errors on profile check, fail open for this specific secondary check
            }

            const billingMode = wallet.billing_mode || 'DIRECT_META';
            const isWalletEnforced = wallet.wallet_enforced === true;

            let checkAmount;
            if (overrideAmount !== null) {
                checkAmount = overrideAmount;
            } else if (billingMode === 'DIRECT_META' || !isWalletEnforced) {
                return true; // No wallet balance required for DIRECT_META or Tracking Mode
            } else {
                const rate = await this.getRate(userId, expectedCategory);
                checkAmount = rate.platform_rate;
            }

            return roundMoney(wallet.balance) >= roundMoney(checkAmount);
        } catch (e) {
            console.error('[WalletService] Balance check error:', e);
            return false; // Security: Fail closed on errors to prevent free credit loop holes
        }
    }

    /**
     * Tracks the source of an outgoing message (e.g., API_SEND, INBOX_SEND) 
     * by creating a zero-amount ledger entry. This ensures the webhook knows exactly 
     * where the message originated.
     */
    static async trackMessageSource({ userId, waMessageId, category, source, contactPhone }) {
        try {
            const wallet = await this.getWallet(userId);
            if (!wallet || wallet.billing_mode === 'DIRECT_META') {
                return; // Do not track in wallet ledger if user is paying Meta directly
            }

            const { data: profile } = await supabaseAdmin.from('profiles').select('signup_domain').eq('id', userId).maybeSingle();
            const { error } = await supabaseAdmin.from('wallet_transactions').insert({
                user_id: userId,
                type: 'DEBIT',
                amount: 0,
                balance_before: wallet.balance,
                balance_after: wallet.balance,
                source: source || 'API_SEND',
                wa_category: category ? category.toUpperCase() : 'UTILITY',
                wa_message_id: waMessageId,
                description: `Message sent via ${source || 'API'} (Pending Meta Delivery)`,
                contact_phone: contactPhone || null,
                tenant_domain: profile?.signup_domain || null
            });
            if (error) console.error('[WalletService] trackMessageSource error:', error);
        } catch (e) {
            console.error('[WalletService] trackMessageSource exception:', e);
        }
    }

    /**
     * PRE-DEBIT (V2 Architecture: Debits at ACTUAL expected template rate)
     */
    static async preDebit({ userId, waMessageId, category, source, contactPhone, campaignId, dripCampaignId, flowId, whatsappAccountId, createdBy, ipAddress }) {
        try {
            const countryCode = this.getCountryCode(contactPhone);
            const requestedCategory = (category || 'MARKETING').toUpperCase();

            // Use the actual requested category for pre-debit to prevent blocking free SERVICE messages.
            // If Meta reclassifies it later, the webhook handler will charge the difference.
            const rate = await this.getRate(userId, requestedCategory, countryCode);
            const actualCategory = requestedCategory;

            let debitAmount = roundMoney(rate.platform_rate);
            let debitMetaCost = roundMoney(rate.meta_cost);
            let debitDescription = `Pre-debit for requested ${requestedCategory}. Msg: ${waMessageId}`;

            const wallet = await this.getWallet(userId);
            const billingMode = wallet.billing_mode || 'DIRECT_META';

            if (billingMode === 'DIRECT_META') {
                return; // NO WALLET DEDUCTION AT ALL for DIRECT_META
            }

            // Explicit application-layer balance check to prevent negative balances
            // Ensures strict checking across ALL flows (Staff Inbox, Campaigns, Drips, API)
            // Fix: Bypass for CAMPAIGN_SEND because funds are already held via RESERVATION_HOLD
            let hasBalance = true;
            if (source !== 'CAMPAIGN_SEND') {
                hasBalance = await this.hasSufficientBalance(userId, debitAmount);
            }

            if (!hasBalance) {
                // Log the failure to the wallet ledger so the user can see it in the UI
                try {
                    const { data: profile } = await supabaseAdmin.from('profiles').select('signup_domain').eq('id', userId).maybeSingle();
                    await supabaseAdmin.from('wallet_transactions').insert({
                        user_id: userId,
                        type: 'DEBIT',
                        amount: 0,
                        balance_before: wallet.balance,
                        balance_after: wallet.balance,
                        source: source || 'INBOX_SEND',
                        wa_category: actualCategory,
                        wa_message_id: waMessageId,
                        tenant_domain: profile?.signup_domain || null,
                        description: `FAILED (BLOCKED): Insufficient Wallet Balance. ₹${debitAmount} required.`,
                        contact_phone: contactPhone,
                        campaign_id: campaignId || null,
                        drip_campaign_id: dripCampaignId || null,
                        flow_id: flowId || null,
                        whatsapp_account_id: whatsappAccountId || null
                    });
                } catch (logErr) {
                    console.error('[WalletService] Failed to log insufficient balance transaction:', logErr);
                }

                throw new Error('Insufficient Wallet Balance. Top-up required.');
            }

            if (debitAmount === 0) {
                // For free messages (e.g. within 24h Service window), do not call the adjust_wallet_balance RPC
                // because it explicitly forbids 0 amount transactions and throws an exception.
                logWalletEvent('PRE_DEBIT_SUCCESS', { userId, waMessageId, amount: debitAmount, category: actualCategory, note: 'Free Message' });
                return { transactionId: null };
            }

            const { data, error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: userId,
                p_amount: debitAmount,
                p_type: 'DEBIT',
                p_source: source || 'INBOX_SEND',
                p_wa_category: actualCategory,
                p_wa_message_id: waMessageId,
                p_wa_conversation_id: null,
                p_conversation_expiry: null,
                p_description: debitDescription,
                p_contact_phone: contactPhone,
                p_campaign_id: campaignId || null,
                p_drip_campaign_id: dripCampaignId || null,
                p_flow_id: flowId || null,
                p_whatsapp_account_id: whatsappAccountId || null,
                p_meta_cost: debitMetaCost,
                p_created_by: createdBy || null,
                p_ip_address: ipAddress || null
            });

            if (error) {
                logWalletEvent('PRE_DEBIT_ERROR', { userId, waMessageId, error: error.message });
                throw error;
            }

            const transactionId = data?.transaction_id;

            logWalletEvent('PRE_DEBIT_SUCCESS', { userId, waMessageId, amount: debitAmount, category: actualCategory });

            // V2: If Tenant Agency Credit Line, we must collect the software markup fee from the Tenant Admin's Master Wallet
            if (billingMode === 'CREDIT_LINE_TENANT') {
                try {
                    // Find the Tenant Admin Master Wallet for this user's domain
                    const { data: userProfile } = await supabaseAdmin
                        .from('profiles')
                        .select('signup_domain')
                        .eq('id', userId)
                        .single();

                    if (userProfile && userProfile.signup_domain) {
                        const { data: domainAdmins } = await supabaseAdmin
                            .from('profiles')
                            .select('id')
                            .eq('signup_domain', userProfile.signup_domain)
                            .in('role', ['admin', 'super_admin']);

                        if (domainAdmins && domainAdmins.length > 0) {
                            const adminIds = domainAdmins.map(a => a.id);
                            const { data: masterWallet } = await supabaseAdmin
                                .from('user_wallets')
                                .select('user_id')
                                .in('user_id', adminIds)
                                .eq('is_tenant_master', true)
                                .limit(1)
                                .maybeSingle();

                            if (masterWallet) {
                                // Fetch the specific rate the Super Admin set for this Tenant Admin
                                const tenantRate = await this.getRate(masterWallet.user_id, actualCategory, countryCode);
                                const markupFee = Math.max(roundMoney(tenantRate.platform_rate - tenantRate.meta_cost), 0);

                                if (markupFee > 0) {
                                    const markupDescription = `Software markup fee for message sent by user (ID: ${userId.substring(0, 8)}...). Msg: ${waMessageId}`;
                                    const { error: markupErr } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                                        p_user_id: masterWallet.user_id,
                                        p_amount: markupFee,
                                        p_type: 'DEBIT',
                                        p_source: 'AGENCY_MARKUP',
                                        p_wa_category: actualCategory,
                                        p_wa_message_id: waMessageId + '_markup',
                                        p_wa_conversation_id: null,
                                        p_conversation_expiry: null,
                                        p_description: markupDescription,
                                        p_contact_phone: contactPhone,
                                        p_campaign_id: campaignId || null,
                                        p_drip_campaign_id: null,
                                        p_flow_id: null,
                                        p_whatsapp_account_id: null,
                                        p_meta_cost: 0, // Meta is paid by Tenant directly
                                        p_created_by: null,
                                        p_ip_address: null
                                    });

                                    if (markupErr) {
                                        logWalletEvent('AGENCY_MARKUP_ERROR', { masterUserId: masterWallet.user_id, waMessageId, error: markupErr.message });
                                    } else {
                                        logWalletEvent('AGENCY_MARKUP_SUCCESS', { masterUserId: masterWallet.user_id, waMessageId, amount: markupFee });
                                    }
                                }
                            }
                        }
                    }
                } catch (markupErr) {
                    console.error('[WalletService] Failed to debit Tenant Master Wallet for markup. Blocking message to prevent SaaS fee loss:', markupErr);
                    logWalletEvent('AGENCY_MARKUP_EXCEPTION', { userId, waMessageId, error: markupErr.message });
                    throw markupErr; // Security: Do not allow the message to send if we cannot collect our fee!
                }
            }

            return { transactionId };
        } catch (e) {
            console.error('[WalletService] Pre-debit error:', e);
            logWalletEvent('PRE_DEBIT_EXCEPTION', { userId, waMessageId, error: e.message });
            throw e;
        }
    }

    /**
     * V2 ATOMIC: Link the generated Meta message ID to the pending preDebit transaction
     */
    static async updateTransactionMessageId(transactionId, actualWaMessageId) {
        if (!transactionId || !actualWaMessageId) return;
        try {
            const { error } = await supabaseAdmin
                .from('wallet_transactions')
                .update({ wa_message_id: actualWaMessageId })
                .eq('id', transactionId);

            if (error) {
                console.error(`[WalletService] Failed to link waMessageId ${actualWaMessageId} to tx ${transactionId}:`, error);
            }
        } catch (err) {
            console.error(`[WalletService] Exception linking waMessageId:`, err);
        }
    }

    /**
     * V2 ATOMIC: Completely reverse a pre-debit if the API call to Meta failed (e.g. invalid number)
     */
    static async refundFailedApiCall(transactionId) {
        if (!transactionId) return;
        try {
            // First, get the transaction details
            const { data: tx, error: fetchErr } = await supabaseAdmin
                .from('wallet_transactions')
                .select('*')
                .eq('id', transactionId)
                .single();

            if (fetchErr || !tx) return;

            // Refund the user's wallet
            const description = `API Send Failed. Full refund for pre-debit. Msg: ${tx.wa_message_id}`;
            await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: tx.user_id,
                p_amount: tx.amount,
                p_type: 'CREDIT',
                p_source: 'REFUND',
                p_wa_category: tx.wa_category,
                p_wa_message_id: tx.wa_message_id,
                p_description: description
            });

            logWalletEvent('API_FAIL_REFUND_SUCCESS', { userId: tx.user_id, waMessageId: tx.wa_message_id, amount: tx.amount });
        } catch (err) {
            console.error(`[WalletService] Exception during refundFailedApiCall:`, err);
        }
    }

    /**
     * WEBHOOK PRICING RECONCILIATION WITH 24-HOUR WINDOW DEDUPLICATION
     * V2 updates: Handles both REFUNDS (cheaper category) and DEBITS (more expensive category)
     */
    static async handleWebhookPricing(userId, waMessageId, pricing, waConversationId, conversationExpiry, contactPhone) {
        if (!userId || !waMessageId) return;

        // --- 🚀 RAM LOCK (First Line of Defense) ---
        // If 1000 identical webhooks hit this container simultaneously, 
        // 999 will be instantly dropped in RAM without touching the Database.
        if (activeWebhookLocks.has(waMessageId)) {
            return;
        }
        activeWebhookLocks.add(waMessageId);

        // Auto-release the RAM lock after 2 minutes to prevent memory leaks
        setTimeout(() => activeWebhookLocks.delete(waMessageId), 120000);

        try {
            const { data: originalTx } = await supabaseAdmin
                .from('wallet_transactions')
                .select('*')
                .eq('wa_message_id', waMessageId)
                .eq('type', 'DEBIT')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!originalTx) {
                // GHOST PREVENTION: Since we now track 100% of wallet messages at the source 
                // (via preDebit or trackMessageSource), any webhook WITHOUT an originalTx 
                // MUST be a ghost from when the user was using DIRECT_META billing mode.
                // We MUST ignore these to prevent double-charging the wallet for past card payments.
                console.warn(`[WalletService] Ignored ghost webhook for ${waMessageId}. (No originalTx found - likely sent via DIRECT_META)`);
                return;
            }

            // IDEMPOTENCY CHECK: Ensure we haven't already refunded or adjusted this exact message
            const { data: existingAdjustments } = await supabaseAdmin
                .from('wallet_transactions')
                .select('id')
                .eq('wa_message_id', waMessageId)
                .in('source', ['REFUND', 'ADJUSTMENT'])
                .limit(1);

            if (existingAdjustments && existingAdjustments.length > 0) {
                console.log(`[WalletService] Idempotency catch: Msg ${waMessageId} already reconciled.`);
                return;
            }

            const preDebitAmount = roundMoney(originalTx.amount);
            const preDebitCategory = (originalTx.wa_category || '').toUpperCase();

            // Determine actual category from webhook, default to original if missing
            const actualCategory = (pricing?.category || preDebitCategory).toUpperCase();
            const countryCode = this.getCountryCode(originalTx.contact_phone || contactPhone);
            const actualRate = await this.getRate(userId, actualCategory, countryCode);

            // Calculate what the user SHOULD pay
            let finalUserCost = roundMoney(actualRate.platform_rate);

            // Is this a free message or inside an existing 24h window?
            let isFreeFromMeta = (pricing?.billable === false);

            if (!isFreeFromMeta && waConversationId) {
                // Check if there is already a charge for this conversation window
                const { data: existingWindowCharge } = await supabaseAdmin
                    .from('wallet_transactions')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('wa_conversation_id', waConversationId)
                    .eq('type', 'DEBIT')
                    .not('source', 'in', '("ADJUSTMENT","REFUND","ADMIN_TOPUP","RECHARGE","WEBHOOK_SYNC")')
                    .neq('wa_message_id', waMessageId)
                    .maybeSingle();

                if (existingWindowCharge) {
                    isFreeFromMeta = true;
                }
            }

            if (waConversationId) {
                // Update conversation ID for tracking
                await supabaseAdmin
                    .from('wallet_transactions')
                    .update({
                        wa_conversation_id: waConversationId,
                        conversation_expiry: conversationExpiry
                    })
                    .eq('wa_message_id', waMessageId)
                    .eq('type', 'DEBIT');
            }

            if (isFreeFromMeta) {
                // Meta is not charging us, and user requested NO markup charge for free messages.
                finalUserCost = 0;
            }

            const delta = roundMoney(finalUserCost - preDebitAmount);

            if (delta < 0) {
                // We pre-debited too much, issue refund
                const refundDiff = Math.abs(delta);
                let description = `Category refund: Pre-debit ${preDebitCategory} ₹${preDebitAmount}, actual=${actualCategory} ₹${finalUserCost}. Refund: ₹${refundDiff.toFixed(4)}`;

                if (isFreeFromMeta) {
                    description = `Markup only charge: Message was free from Meta. Pre-debit ₹${preDebitAmount}, markup ₹${finalUserCost}. Refund: ₹${refundDiff.toFixed(4)}`;
                }

                await this._issueRefund(userId, waMessageId, refundDiff,
                    'ADJUSTMENT', actualCategory, waConversationId, description);
            } else if (delta > 0) {
                // We pre-debited too little (e.g. Utility -> Marketing)
                console.warn(`[WalletService] Reclassification Delta: ${preDebitCategory} -> ${actualCategory}. Charging delta ₹${delta}`);
                const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                    p_user_id: userId,
                    p_amount: delta,
                    p_type: 'DEBIT',
                    p_source: originalTx.source || 'ADJUSTMENT',
                    p_wa_category: actualCategory,
                    p_wa_message_id: waMessageId,
                    p_wa_conversation_id: waConversationId,
                    p_conversation_expiry: null,
                    p_description: `Webhook Sync: Late debit for ${originalTx.source || 'message'}. Delta: ₹${delta.toFixed(4)}`,
                    p_contact_phone: null,
                    p_campaign_id: null,
                    p_drip_campaign_id: null,
                    p_flow_id: null,
                    p_whatsapp_account_id: null,
                    p_meta_cost: 0,
                    p_created_by: null,
                    p_ip_address: null
                });
                if (error) console.error('[WalletService] Delta charge error:', error);
            }

        } catch (e) {
            console.error('[WalletService] handleWebhookPricing error:', e);
        }
    }

    /**
     * FAILED MESSAGE RECONCILIATION
     * If a message fails to deliver, we must fully refund the pre-debit.
     */
    static async handleWebhookFailure(userId, waMessageId) {
        try {
            const { data: originalTx } = await supabaseAdmin
                .from('wallet_transactions')
                .select('*')
                .eq('wa_message_id', waMessageId)
                .eq('type', 'DEBIT')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            if (!originalTx) return; // No pre-debit found (e.g., text message)

            // IDEMPOTENCY CHECK
            const { data: existingAdjustments } = await supabaseAdmin
                .from('wallet_transactions')
                .select('id')
                .eq('wa_message_id', waMessageId)
                .in('source', ['REFUND', 'ADJUSTMENT'])
                .limit(1);

            if (existingAdjustments && existingAdjustments.length > 0) return;

            // Full refund because the message bounced and we didn't provide the service
            const refundAmount = roundMoney(originalTx.amount);
            if (refundAmount > 0) {
                await this._issueRefund(userId, waMessageId, refundAmount,
                    'REFUND', null, null,
                    `Full refund ₹${refundAmount} — message delivery failed`);
            }
        } catch (e) {
            console.error('[WalletService] handleWebhookFailure error:', e);
        }
    }

    /**
     * Refund wrapper with strict validation
     */
    static async _issueRefund(userId, waMessageId, amount, source, waCategory, waConversationId, description) {
        // Strict validation: wallet must not be frozen
        const wallet = await this.getWallet(userId);
        if (wallet.wallet_frozen) {
            console.error(`[WalletService] Cannot issue refund: Wallet is frozen for user ${userId}`);
            return false;
        }

        const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
            p_user_id: userId,
            p_amount: amount,
            p_type: 'CREDIT',
            p_source: source,
            p_wa_category: waCategory,
            p_wa_message_id: waMessageId,
            p_wa_conversation_id: waConversationId,
            p_conversation_expiry: null,
            p_description: description,
            p_contact_phone: null,
            p_campaign_id: null,
            p_drip_campaign_id: null,
            p_flow_id: null,
            p_whatsapp_account_id: null,
            p_meta_cost: 0,
            p_created_by: null,
            p_ip_address: null
        });
        if (error) {
            // 23505 is PostgreSQL's unique_violation code
            if (error.code === '23505' || (error.message && error.message.includes('unique constraint'))) {
                console.warn(`[WalletService] Idempotency Race Condition Caught: Refund for ${waMessageId} was already processed by another thread. Safely ignored.`);
                return false;
            }
            console.error('[WalletService] Refund/adjustment error:', error);
        }
        return !error;
    }

    static async _handleUntrackedBillable(userId, waMessageId, pricing, waConversationId, conversationExpiry, contactPhone) {
        const wallet = await this.getWallet(userId);
        if (wallet.billing_mode === 'DIRECT_META') return; // No late debits for DIRECT_META

        if (waConversationId) {
            const { data: existingCharge } = await supabaseAdmin
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('wa_conversation_id', waConversationId)
                .eq('type', 'DEBIT')
                .maybeSingle();

            if (existingCharge) return;
        }

        const countryCode = this.getCountryCode(contactPhone);
        const category = pricing.category.toUpperCase();
        const rate = await this.getRate(userId, category, countryCode);
        const amount = Number(rate.platform_rate);

        if (amount > 0) {
            const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: userId,
                p_amount: amount,
                p_type: 'DEBIT',
                p_source: 'WEBHOOK_SYNC',
                p_wa_category: category,
                p_wa_message_id: waMessageId,
                p_wa_conversation_id: waConversationId,
                p_conversation_expiry: conversationExpiry,
                p_description: `Late debit: untracked ${category} conversation. ₹${amount}`,
                p_contact_phone: null,
                p_campaign_id: null,
                p_drip_campaign_id: null,
                p_flow_id: null,
                p_whatsapp_account_id: null,
                p_meta_cost: 0,
                p_created_by: null,
                p_ip_address: null
            });
            if (error) console.error('[WalletService] Untracked debit error:', error);
        }
    }

    static async addCredit(userId, amount, source = 'ADMIN_TOPUP', description = 'Wallet Top-up', createdBy = null, ipAddress = null) {
        const { data, error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
            p_user_id: userId,
            p_amount: amount,
            p_type: 'CREDIT',
            p_source: source,
            p_description: description,
            p_created_by: createdBy,
            p_ip_address: ipAddress,
            p_wa_category: null,
            p_wa_message_id: null,
            p_wa_conversation_id: null,
            p_conversation_expiry: null,
            p_contact_phone: null,
            p_campaign_id: null,
            p_drip_campaign_id: null,
            p_flow_id: null,
            p_whatsapp_account_id: null,
            p_meta_cost: 0
        });
        if (error) throw error;
        return { success: true, ...data };
    }



    static sourceForContext(context) {
        const map = {
            campaign: 'CAMPAIGN_SEND',
            drip: 'DRIP_SEND',
            flow: 'FLOW_SEND',
            inbox: 'INBOX_SEND',
            api: 'API_SEND',
        };
        return map[context] || 'INBOX_SEND';
    }
}

module.exports = WalletService;
