const { supabaseAdmin } = require('../lib/supabaseClient');
const { parsePhoneNumberFromString } = require('libphonenumber-js');


// ─────────────────────────────────────────────────────────────────────────────
// WHATSAPP BILLING MODEL (Meta Cloud API)
//
// HOW META CHARGES:
//   Meta charges per CONVERSATION WINDOW, not per MESSAGE.
//   A conversation window = 24 hours from the first message that opened it.
//   The same wa_conversation_id is used for all messages in that window.
//
//   Window Types:
//   - USER-INITIATED (Service): User messages business first → 24h free-form window
//     → Charged as SERVICE category conversation
//   - BUSINESS-INITIATED: Business sends template first → opens category window
//     → MARKETING / UTILITY / AUTHENTICATION conversation
//
// OUR BILLING STRATEGY (Conservative Pre-debit, matching AiSensy/Wati/Interakt):
//
//   Step 1 — PRE-DEBIT: Before sending any template, debit MARKETING rate (worst-case).
//             This prevents sends when balance is too low even for the most expensive category.
//
//   Step 2 — WEBHOOK RECONCILE: When Meta sends 'sent' status webhook, it includes:
//             status.pricing.billable        — is this conversation billable?
//             status.pricing.category        — actual conversation category
//             status.conversation.id         — the 24h window ID (same for all msgs in window)
//             status.conversation.expiration_timestamp — when this window expires
//
//   Step 3 — DEDUP CHECK: If we already have a DEBIT for this wa_conversation_id,
//             the conversation window was already billed → REFUND the pre-debit.
//             If this is the FIRST message in the window → reconcile category.
//
//   Result:
//     - 5 messages sent in same window → only 1 conversation charge ✅
//     - Category reclassification → refund difference ✅
//     - Non-billable → full refund ✅
//     - Balance NEVER goes negative ✅
// ─────────────────────────────────────────────────────────────────────────────

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
     * Get effective rate for a user + category.

     * Lookup: WORKSPACE override → GLOBAL default → hardcoded fallback.
     */
    static async getRate(userId, category, countryCode = 'IN') {
        category = (category || 'MARKETING').toUpperCase();

        const { data: workspaceRate } = await supabaseAdmin
            .from('wa_message_rates')
            .select('platform_rate, meta_cost')
            .eq('scope', 'WORKSPACE').eq('user_id', userId)
            .eq('category', category).eq('country_code', countryCode)
            .eq('is_active', true).maybeSingle();

        if (workspaceRate) return workspaceRate;

        const { data: globalRate } = await supabaseAdmin
            .from('wa_message_rates')
            .select('platform_rate, meta_cost')
            .eq('scope', 'GLOBAL').is('user_id', null)
            .eq('category', category).eq('country_code', countryCode)
            .eq('is_active', true).maybeSingle();

        if (globalRate) return globalRate;

        const fallbacks = {
            MARKETING:      { platform_rate: 0.70, meta_cost: 0.0128 },
            UTILITY:        { platform_rate: 0.22, meta_cost: 0.0040 },
            AUTHENTICATION: { platform_rate: 0.22, meta_cost: 0.0040 },
            SERVICE:        { platform_rate: 0.20, meta_cost: 0.0040 }
        };
        return fallbacks[category] || fallbacks.SERVICE;
    }

    /**
     * CONSERVATIVE BALANCE CHECK — always checks against MARKETING rate (worst-case).
     *
     * Billing Mode logic:
     *   DIRECT_META        → User pays Meta directly. Only check platform_cost markup.
     *   CREDIT_LINE_SUPER  → Full cost check (meta + platform). Enforced strictly.
     *   CREDIT_LINE_TENANT → Full cost check (meta + platform). Enforced strictly.
     *
     * @param {string} userId
     * @param {number} [overrideAmount] - If provided, check this specific amount
     * @returns {Promise<boolean>} true if sufficient (or not enforced)
     */
    static async hasSufficientBalance(userId, overrideAmount = null) {
        try {
            const wallet = await this.getWallet(userId);
            if (!wallet.wallet_enforced) return true;

            const billingMode = wallet.billing_mode || 'CREDIT_LINE_SUPER';

            let checkAmount;
            if (overrideAmount !== null) {
                checkAmount = overrideAmount;
            } else if (billingMode === 'DIRECT_META') {
                // DIRECT_META: user pays Meta themselves. Only check our platform markup.
                const marketingRate = await this.getRate(userId, 'MARKETING');
                checkAmount = Number(marketingRate.platform_rate) - Number(marketingRate.meta_cost);
                checkAmount = Math.max(checkAmount, 0.01); // Minimum markup check
                console.log(`[WalletService] DIRECT_META: checking platform markup only = ₹${checkAmount}`);
            } else {
                // CREDIT_LINE_SUPER / CREDIT_LINE_TENANT: full cost at worst-case MARKETING rate
                const marketingRate = await this.getRate(userId, 'MARKETING');
                checkAmount = marketingRate.platform_rate;
            }

            return Number(wallet.balance) >= Number(checkAmount);
        } catch (e) {
            console.error('[WalletService] Balance check error:', e);
            return true; // Fail open — don't block sends on DB errors
        }
    }

    /**
     * CONSERVATIVE PRE-DEBIT
     *
     * Always debits at MARKETING rate before sending.
     * Webhook reconciliation will refund if actual category is cheaper.
     *
     * @param {Object} params
     * @param {string} params.userId
     * @param {string} params.waMessageId       WhatsApp Message ID from Meta API response
     * @param {string} params.category          Template category (for description only)
     * @param {string} params.source            CAMPAIGN_SEND / INBOX_SEND / FLOW_SEND / DRIP_SEND / API_SEND
     * @param {string} [params.contactPhone]
     * @param {string} [params.campaignId]
     * @param {string} [params.dripCampaignId]
     * @param {string} [params.flowId]
     * @param {string} [params.whatsappAccountId]
     */
    static async preDebit({ userId, waMessageId, category, source, contactPhone, campaignId, dripCampaignId, flowId, whatsappAccountId }) {
        try {
            const countryCode = this.getCountryCode(contactPhone);
            const marketingRate = await this.getRate(userId, 'MARKETING', countryCode);

            // ── Billing Mode: determine how much to deduct ──────────────────
            let debitAmount = Number(marketingRate.platform_rate);
            let debitMetaCost = Number(marketingRate.meta_cost);
            let debitDescription = `Conservative pre-debit at MARKETING rate (template category: ${category || '?'}). Will reconcile at webhook.`;

            // Fetch wallet billing_mode
            const wallet = await this.getWallet(userId);
            const billingMode = wallet.billing_mode || 'CREDIT_LINE_SUPER';

            if (billingMode === 'DIRECT_META') {
                // DIRECT_META: Meta charges user directly — only deduct our platform markup
                debitAmount = Math.max(Number(marketingRate.platform_rate) - Number(marketingRate.meta_cost), 0.01);
                debitMetaCost = 0; // We don't incur Meta cost
                debitDescription = `Platform markup only (DIRECT_META mode). User pays Meta directly. Msg: ${waMessageId}`;
                console.log(`[WalletService] DIRECT_META: Pre-debit platform markup only = ₹${debitAmount}`);
            } else {
                console.log(`[WalletService] ${billingMode}: Pre-debit full MARKETING rate = ₹${debitAmount}`);
            }
            // ────────────────────────────────────────────────────────────────

            const { error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
                p_user_id: userId,
                p_amount: debitAmount,
                p_type: 'DEBIT',
                p_source: source || 'INBOX_SEND',
                p_wa_category: 'MARKETING',
                p_wa_message_id: waMessageId,
                p_description: debitDescription,
                p_contact_phone: contactPhone,
                p_campaign_id: campaignId || null,
                p_drip_campaign_id: dripCampaignId || null,
                p_flow_id: flowId || null,
                p_whatsapp_account_id: whatsappAccountId,
                p_meta_cost: debitMetaCost
            });

            if (error) throw error;
            console.log(`[WalletService] ✅ Pre-debit ₹${debitAmount} (${billingMode}) for ${category} template. Msg: ${waMessageId}`);
        } catch (e) {
            console.error('[WalletService] Pre-debit error:', e);
            throw e;
        }
    }

    /**
     * WEBHOOK PRICING RECONCILIATION WITH 24-HOUR WINDOW DEDUPLICATION
     *
     * Called on each 'sent' status webhook.
     *
     * KEY BILLING RULE:
     *   Meta charges per CONVERSATION (24h window), not per message.
     *   The webhook includes status.conversation.id — the same ID for all messages in the window.
     *   If we've already billed this conversation_id → REFUND the pre-debit (already paid for window).
     *   If this is the first message in the window → do normal category reconciliation.
     *
     * Reconciliation scenarios:
     *
     *   A) billable=false → full refund (not charged by Meta)
     *   B) conversation already billed (same wa_conversation_id exists) → full refund of pre-debit
     *   C) category=MARKETING → no change (pre-debit was already at correct rate)
     *   D) category=UTILITY/AUTH/SERVICE → refund difference (pre-debit was MARKETING, actual is cheaper)
     *   E) no prior pre-debit (untracked) + billable=true → WEBHOOK_SYNC debit
     *
     * @param {string} userId
     * @param {string} waMessageId
     * @param {Object} pricing    - { billable, category, pricing_model }
     * @param {Object} [conversation] - { id, expiration_timestamp } from Meta webhook
     * @param {string} [contactPhone] - from status.recipient_id
     */
    static async handleWebhookPricing(userId, waMessageId, pricing, conversation = null, contactPhone = null) {
        if (!pricing) return;

        const waConversationId = conversation?.id || null;
        const conversationExpiry = conversation?.expiration_timestamp
            ? new Date(conversation.expiration_timestamp * 1000).toISOString()
            : null;

        try {
            // ── Find original pre-debit transaction ──────────────────────────
            const { data: originalTx } = await supabaseAdmin
                .from('wallet_transactions')
                .select('*')
                .eq('wa_message_id', waMessageId)
                .eq('type', 'DEBIT')
                .order('created_at', { ascending: true })
                .limit(1)
                .maybeSingle();

            // ── SCENARIO E: Untracked billable (playground, coexistence, manual) ─
            if (!originalTx) {
                if (pricing.billable === true && pricing.category) {
                    await this._handleUntrackedBillable(userId, waMessageId, pricing, waConversationId, conversationExpiry, contactPhone);
                }
                return;
            }

            // ── SCENARIO A: Not billable → full refund ────────────────────────
            if (pricing.billable === false) {
                await this._issueRefund(userId, waMessageId, Number(originalTx.amount),
                    'REFUND', null, waConversationId,
                    `Full refund ₹${originalTx.amount} — message was not billed by Meta`);
                console.log(`[WalletService] REFUND ₹${originalTx.amount} — non-billable msg ${waMessageId}`);
                return;
            }

            // ── SCENARIO B: 24-HOUR WINDOW ALREADY BILLED ───────────────────
            // Check if this conversation window was already charged
            if (waConversationId) {
                const { data: existingWindowCharge } = await supabaseAdmin
                    .from('wallet_transactions')
                    .select('id, amount, wa_category')
                    .eq('user_id', userId)
                    .eq('wa_conversation_id', waConversationId)
                    .eq('type', 'DEBIT')
                    .not('source', 'in', '("ADJUSTMENT","REFUND","ADMIN_TOPUP","RECHARGE","WEBHOOK_SYNC")')
                    .neq('wa_message_id', waMessageId)  // Exclude the current pre-debit
                    .maybeSingle();

                if (existingWindowCharge) {
                    // Conversation window was ALREADY billed by a previous message → refund this pre-debit
                    const refundAmount = Number(originalTx.amount);
                    await this._issueRefund(userId, waMessageId, refundAmount,
                        'ADJUSTMENT', pricing.category?.toUpperCase(), waConversationId,
                        `24h window already billed (conv: ${waConversationId}, first msg billed: ${existingWindowCharge.id}). Full refund ₹${refundAmount}.`);
                    
                    console.log(`[WalletService] 24H WINDOW DEDUP: Refund ₹${refundAmount} — conversation ${waConversationId} already billed. Msg: ${waMessageId}`);
                    return;
                }

                // First message in this window — update the pre-debit transaction with conversation ID
                await supabaseAdmin
                    .from('wallet_transactions')
                    .update({
                        wa_conversation_id: waConversationId,
                        conversation_expiry: conversationExpiry
                    })
                    .eq('wa_message_id', waMessageId)
                    .eq('type', 'DEBIT');
            }

            // ── SCENARIOS C & D: Category reconciliation ─────────────────────
            if (pricing.category) {
                const actualCategory = pricing.category.toUpperCase();
                const preDebitAmount = Number(originalTx.amount); // Always MARKETING rate

                if (actualCategory === 'MARKETING') {
                    // SCENARIO C: No change. Pre-debit was at MARKETING — correct.
                    console.log(`[WalletService] MARKETING confirmed for ${waMessageId} — no adjustment needed.`);
                    return;
                }

                // SCENARIO D: Cheaper category → refund the difference
                const countryCode = this.getCountryCode(originalTx.contact_phone || contactPhone);
                const actualRate = await this.getRate(userId, actualCategory, countryCode);
                const actualAmount = Number(actualRate.platform_rate);
                const refundDiff = preDebitAmount - actualAmount;

                if (refundDiff > 0) {
                    await this._issueRefund(userId, waMessageId, refundDiff,
                        'ADJUSTMENT', actualCategory, waConversationId,
                        `Category refund: Pre-debit MARKETING ₹${preDebitAmount}, actual=${actualCategory} ₹${actualAmount}. Refund: ₹${refundDiff.toFixed(4)}`);
                    console.log(`[WalletService] CATEGORY REFUND ₹${refundDiff.toFixed(4)} — ${actualCategory} cheaper than MARKETING. Msg: ${waMessageId}`);
                } else if (refundDiff < 0) {
                    console.warn(`[WalletService] Rate anomaly: actual ₹${actualAmount} > MARKETING pre-debit ₹${preDebitAmount}. Check rates config.`);
                }
            }

        } catch (e) {
            console.error('[WalletService] handleWebhookPricing error:', e);
        }
    }

    /**
     * Issue a CREDIT (refund or adjustment)
     * @private
     */
    static async _issueRefund(userId, waMessageId, amount, source, waCategory, waConversationId, description) {
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

    /**
     * Handle untracked billable messages (playground, coexistence, direct API)
     * These never had a pre-debit — we debit now at actual category rate.
     * @private
     */
    static async _handleUntrackedBillable(userId, waMessageId, pricing, waConversationId, conversationExpiry, contactPhone) {
        // Also check 24h window dedup — don't double-charge even for untracked
        if (waConversationId) {
            const { data: existingCharge } = await supabaseAdmin
                .from('wallet_transactions')
                .select('id')
                .eq('user_id', userId)
                .eq('wa_conversation_id', waConversationId)
                .eq('type', 'DEBIT')
                .maybeSingle();

            if (existingCharge) {
                console.log(`[WalletService] WEBHOOK_SYNC: Skipped — conversation ${waConversationId} already billed.`);
                return;
            }
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
                p_description: `Late debit: untracked ${category} conversation (playground/coexistence/manual API). ₹${amount}`
            });
            if (error) console.error('[WalletService] Untracked debit error:', error);
            else console.log(`[WalletService] WEBHOOK_SYNC debit ₹${amount} for untracked ${category} msg ${waMessageId}`);
        }
    }

    /**
     * Add credit to user wallet (Admin Top-up / Recharge)
     */
    static async addCredit(userId, amount, source = 'ADMIN_TOPUP', description = 'Wallet Top-up') {
        const { data, error } = await supabaseAdmin.rpc('adjust_wallet_balance', {
            p_user_id: userId,
            p_amount: amount,
            p_type: 'CREDIT',
            p_source: source,
            p_description: description
        });
        if (error) throw error;
        return { success: true, ...data };
    }

    /**
     * Map send context to wallet source string.
     * @param {'campaign'|'drip'|'flow'|'inbox'|'api'} context
     */
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
