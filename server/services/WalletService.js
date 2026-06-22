const { supabaseAdmin } = require('../lib/supabaseClient');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP BILLING MODEL (Meta Cloud API) - V2 Architecture (Optimized)
// ─────────────────────────────────────────────────────────────────────────────

const rateCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const roundMoney = (val) => Math.round(Number(val) * 10000) / 10000;

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
        const targetTenantId = tenantId || userId;
        const cacheKey = `${userId}_${targetTenantId}_${category}_${countryCode}`;

        const cached = rateCache.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.rate;
        }

        // Single query fetching all possible hierarchies
        const { data: rates } = await supabaseAdmin
            .from('wa_message_rates')
            .select('scope, user_id, platform_rate, meta_cost')
            .eq('category', category)
            .eq('country_code', countryCode)
            .eq('is_active', true)
            .or(`user_id.eq.${userId},user_id.eq.${targetTenantId},scope.eq.GLOBAL`);

        let selectedRate = null;

        if (rates && rates.length > 0) {
            const userRate = rates.find(r => r.scope === 'USER' && r.user_id === userId);
            const tenantRate = rates.find(r => ['TENANT', 'WORKSPACE'].includes(r.scope) && r.user_id === targetTenantId);
            const globalRate = rates.find(r => r.scope === 'GLOBAL');

            selectedRate = userRate || tenantRate || globalRate;
        }

        if (!selectedRate) {
            const fallbacks = {
                MARKETING:      { platform_rate: 0.70, meta_cost: 0.0128 },
                UTILITY:        { platform_rate: 0.22, meta_cost: 0.0040 },
                AUTHENTICATION: { platform_rate: 0.22, meta_cost: 0.0040 },
                SERVICE:        { platform_rate: 0.20, meta_cost: 0.0040 }
            };
            selectedRate = fallbacks[category] || fallbacks.SERVICE;
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
            if (!wallet.wallet_enforced) return true;

            const billingMode = wallet.billing_mode || 'CREDIT_LINE_SUPER';

            let checkAmount;
            if (overrideAmount !== null) {
                checkAmount = overrideAmount;
            } else if (billingMode === 'DIRECT_META') {
                return true; // No wallet balance required for DIRECT_META
            } else {
                const rate = await this.getRate(userId, expectedCategory);
                checkAmount = rate.platform_rate;
            }

            return roundMoney(wallet.balance) >= roundMoney(checkAmount);
        } catch (e) {
            console.error('[WalletService] Balance check error:', e);
            return true;
        }
    }

    /**
     * PRE-DEBIT (V2 Architecture: Debits at ACTUAL expected template rate)
     */
    static async preDebit({ userId, waMessageId, category, source, contactPhone, campaignId, dripCampaignId, flowId, whatsappAccountId, createdBy, ipAddress }) {
        try {
            const countryCode = this.getCountryCode(contactPhone);
            const requestedCategory = (category || 'MARKETING').toUpperCase();
            
            // MAX RISK HOLD: Always debit at MARKETING rate to prevent negative balances if Meta reclassifies
            const rate = await this.getRate(userId, 'MARKETING', countryCode);
            const actualCategory = 'MARKETING';

            let debitAmount = roundMoney(rate.platform_rate);
            let debitMetaCost = roundMoney(rate.meta_cost);
            let debitDescription = `Pre-debit at MAX RISK (MARKETING) rate for requested ${requestedCategory}. Will refund at webhook if cheaper. Msg: ${waMessageId}`;

            const wallet = await this.getWallet(userId);
            const billingMode = wallet.billing_mode || 'CREDIT_LINE_SUPER';

            if (billingMode === 'DIRECT_META') {
                return; // NO WALLET DEDUCTION AT ALL for DIRECT_META
            }

            const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: userId,
                p_amount: debitAmount,
                p_type: 'DEBIT',
                p_source: source || 'INBOX_SEND',
                p_wa_category: actualCategory,
                p_wa_message_id: waMessageId,
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

            if (error) throw error;

            // V2: If Tenant Agency Credit Line, we must collect the software markup fee from the Tenant Admin's Master Wallet
            if (billingMode === 'CREDIT_LINE_TENANT') {
                try {
                    const markupFee = Math.max(roundMoney(rate.platform_rate - rate.meta_cost), 0.01);
                    
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
                                const markupDescription = `Software markup fee for message sent by user (ID: ${userId.substring(0,8)}...). Msg: ${waMessageId}`;
                                await supabaseAdmin.rpc('adjust_wallet_balance', {
                                    p_user_id: masterWallet.user_id,
                                    p_amount: markupFee,
                                    p_type: 'DEBIT',
                                    p_source: 'AGENCY_MARKUP_FEE',
                                    p_wa_category: actualCategory,
                                    p_wa_message_id: waMessageId + '_markup',
                                    p_description: markupDescription,
                                    p_contact_phone: contactPhone,
                                    p_campaign_id: campaignId || null,
                                    p_meta_cost: 0 // Meta is paid by Tenant directly
                                });
                            }
                        }
                    }
                } catch (markupErr) {
                    console.error('[WalletService] Failed to debit Tenant Master Wallet for markup:', markupErr);
                    // We don't throw here to avoid blocking the user's message if the markup deduction fails
                }
            }
        } catch (e) {
            console.error('[WalletService] Pre-debit error:', e);
            throw e;
        }
    }

    /**
     * WEBHOOK PRICING RECONCILIATION WITH 24-HOUR WINDOW DEDUPLICATION
     * V2 updates: Handles both REFUNDS (cheaper category) and DEBITS (more expensive category)
     */
    static async handleWebhookPricing(userId, waMessageId, pricing, conversation = null, contactPhone = null) {
        if (!pricing) return;

        const waConversationId = conversation?.id || null;
        const conversationExpiry = conversation?.expiration_timestamp
            ? new Date(conversation.expiration_timestamp * 1000).toISOString()
            : null;

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
                if (pricing.billable === true && pricing.category) {
                    await this._handleUntrackedBillable(userId, waMessageId, pricing, waConversationId, conversationExpiry, contactPhone);
                }
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

            if (pricing.billable === false) {
                // BUG FIX: Only refund meta_cost to retain platform markup
                const refundAmount = roundMoney(originalTx.meta_cost || 0);
                if (refundAmount > 0) {
                    await this._issueRefund(userId, waMessageId, refundAmount,
                        'REFUND', null, waConversationId,
                        `Meta Cost Refund ₹${refundAmount} — message was not billed by Meta (Free Entry/Tier)`);
                }
                return;
            }

            if (waConversationId) {
                const { data: existingWindowCharge } = await supabaseAdmin
                    .from('wallet_transactions')
                    .select('id, amount, wa_category')
                    .eq('user_id', userId)
                    .eq('wa_conversation_id', waConversationId)
                    .eq('type', 'DEBIT')
                    .not('source', 'in', '("ADJUSTMENT","REFUND","ADMIN_TOPUP","RECHARGE","WEBHOOK_SYNC")')
                    .neq('wa_message_id', waMessageId)
                    .maybeSingle();

                if (existingWindowCharge) {
                    // BUG FIX: Only refund meta_cost for subsequent messages in a 24h window
                    const refundAmount = roundMoney(originalTx.meta_cost || 0);
                    if (refundAmount > 0) {
                        await this._issueRefund(userId, waMessageId, refundAmount,
                            'ADJUSTMENT', pricing.category?.toUpperCase(), waConversationId,
                            `24h window already billed. Meta Cost Refund ₹${refundAmount}.`);
                    }
                    return;
                }

                await supabaseAdmin
                    .from('wallet_transactions')
                    .update({
                        wa_conversation_id: waConversationId,
                        conversation_expiry: conversationExpiry
                    })
                    .eq('wa_message_id', waMessageId)
                    .eq('type', 'DEBIT');
            }

            if (pricing.category) {
                const actualCategory = pricing.category.toUpperCase();
                const preDebitCategory = (originalTx.wa_category || '').toUpperCase();
                const preDebitAmount = roundMoney(originalTx.amount);

                if (actualCategory === preDebitCategory) {
                    return; // No change needed
                }

                const countryCode = this.getCountryCode(originalTx.contact_phone || contactPhone);
                const actualRate = await this.getRate(userId, actualCategory, countryCode);
                const actualAmount = roundMoney(actualRate.platform_rate);
                
                const delta = roundMoney(actualAmount - preDebitAmount);

                if (delta < 0) {
                    // Cheaper Category -> Refund Difference
                    const refundDiff = Math.abs(delta);
                    await this._issueRefund(userId, waMessageId, refundDiff,
                        'ADJUSTMENT', actualCategory, waConversationId,
                        `Category refund: Pre-debit ${preDebitCategory} ₹${preDebitAmount}, actual=${actualCategory} ₹${actualAmount}. Refund: ₹${refundDiff.toFixed(4)}`);
                } else if (delta > 0) {
                    // More Expensive Category -> Debit Difference (e.g. Utility -> Marketing)
                    console.warn(`[WalletService] Reclassification Delta: ${preDebitCategory} -> ${actualCategory}. Charging delta ₹${delta}`);
                    const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                        p_user_id: userId,
                        p_amount: delta,
                        p_type: 'DEBIT',
                        p_source: 'ADJUSTMENT',
                        p_wa_category: actualCategory,
                        p_wa_message_id: waMessageId,
                        p_wa_conversation_id: waConversationId,
                        p_description: `Reclassification charge: ${preDebitCategory} to ${actualCategory}. Delta: ₹${delta.toFixed(4)}`
                    });
                    if (error) console.error('[WalletService] Delta charge error:', error);
                }
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
            p_description: description
        });
        if (error) console.error('[WalletService] Refund/adjustment error:', error);
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
                p_description: `Late debit: untracked ${category} conversation. ₹${amount}`
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
            p_ip_address: ipAddress
        });
        if (error) throw error;
        return { success: true, ...data };
    }

    /**
     * CAMPAIGN RESERVATIONS
     */
    static async holdCampaignReservation(userId, campaignId, estimatedCost, allowPartial = false) {
        if (!estimatedCost || estimatedCost <= 0) return { success: true };
        const { data, error } = await supabaseAdmin.rpc('hold_campaign_reservation', {
            p_user_id: userId,
            p_amount: estimatedCost,
            p_campaign_id: campaignId,
            p_description: `Reservation hold for Campaign ${campaignId}`,
            p_allow_partial: allowPartial
        });
        if (error) throw error;
        return { success: true, ...data };
    }

    static async releaseCampaignReservation(userId, campaignId, unusedAmount) {
        if (!unusedAmount || unusedAmount <= 0) return { success: true };
        const { data, error } = await supabaseAdmin.rpc('release_campaign_reservation', {
            p_user_id: userId,
            p_amount: unusedAmount,
            p_campaign_id: campaignId,
            p_description: `Releasing unused reservation for Campaign ${campaignId}`
        });
        if (error) throw error;
        return { success: true, ...data };
    }

    static sourceForContext(context) {
        const map = {
            campaign: 'CAMPAIGN_SEND',
            drip:     'DRIP_SEND',
            flow:     'FLOW_SEND',
            inbox:    'INBOX_SEND',
            api:      'API_SEND',
        };
        return map[context] || 'INBOX_SEND';
    }
}

module.exports = WalletService;
