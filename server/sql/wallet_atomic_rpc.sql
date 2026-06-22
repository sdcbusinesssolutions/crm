-- ⚠️ ⚠️ ⚠️  DEPRECATED — DO NOT RUN  ⚠️ ⚠️ ⚠️
-- This file contains the OLD wallet_atomic_rpc function with the wallet_enforced bypass loophole.
-- The PATCHED version is: server/sql/wallet_atomic_rpc_v2.sql
-- Running this file will OVERWRITE the patched functions with vulnerable code.
-- =============================================================================

-- Original file contents preserved below for reference only:

-- Migration: Create Atomic Wallet RPC Function to prevent race conditions
-- Run this in the Supabase SQL Editor
--
-- CONSERVATIVE PRE-DEBIT STRATEGY:
--   Pre-debits always happen at MARKETING rate (worst-case).
--   When Meta confirms a cheaper category via webhook, a CREDIT refund is issued for the difference.
--   This ensures balance NEVER goes negative due to category reclassification.
--
-- ADJUSTMENT SOURCE HANDLING:
--   If an ADJUSTMENT DEBIT would push balance below 0, we clamp to 0 and log the debt
--   in the description rather than failing silently or throwing an unhandled exception.

CREATE OR REPLACE FUNCTION adjust_wallet_balance(
    p_user_id UUID,
    p_amount NUMERIC,
    p_type TEXT,
    p_source TEXT,
    p_wa_category TEXT DEFAULT NULL,
    p_wa_message_id TEXT DEFAULT NULL,
    p_wa_conversation_id TEXT DEFAULT NULL,
    p_conversation_expiry TIMESTAMPTZ DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_contact_phone TEXT DEFAULT NULL,
    p_campaign_id UUID DEFAULT NULL,
    p_drip_campaign_id UUID DEFAULT NULL,
    p_flow_id UUID DEFAULT NULL,
    p_whatsapp_account_id UUID DEFAULT NULL,
    p_meta_cost NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.user_wallets%ROWTYPE;
    v_new_balance NUMERIC;
    v_tx_id UUID;
    v_actual_debit NUMERIC;
    v_description TEXT;
    v_is_adjustment BOOLEAN;
BEGIN
    -- 1. Lock the wallet row to prevent race conditions (Atomic Transaction)
    SELECT * INTO v_wallet
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    v_is_adjustment := (p_source IN ('ADJUSTMENT', 'WEBHOOK_SYNC'));
    v_actual_debit := p_amount;
    v_description := p_description;

    -- 2. Determine if balance should actually change
    -- Always apply for ADMIN_TOPUP / RECHARGE. For others, only if enforced.
    IF v_wallet.wallet_enforced = TRUE OR p_source IN ('ADMIN_TOPUP', 'RECHARGE') THEN
        IF p_type = 'DEBIT' THEN
            v_new_balance := v_wallet.balance - p_amount;
        ELSIF p_type = 'CREDIT' THEN
            v_new_balance := v_wallet.balance + p_amount;
        ELSE
            RAISE EXCEPTION 'Invalid transaction type: %', p_type;
        END IF;
    ELSE
        -- If not enforced, balance stays the same (ghost transaction for reporting only)
        v_new_balance := v_wallet.balance;
    END IF;

    -- 3. Balance guards
    IF p_type = 'DEBIT' AND v_wallet.wallet_enforced = TRUE THEN
        IF v_new_balance < 0 THEN
            -- For INITIAL sends (pre-debit), BLOCK: wallet is too low to send at all.
            IF NOT v_is_adjustment THEN
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Enforced mode prevents negative balance. Current: %', v_wallet.balance;
            END IF;

            -- For ADJUSTMENTS (post-send category reclassification):
            --   Clamp to 0 — the message already sent. Log the debt note.
            --   This matches how AiSensy/Wati handle it: they allow the send (conservative pre-debit
            --   already happened at MARKETING rate), so this path should rarely fire.
            --   If it does (e.g. manual adjustment), clamp rather than corrupt data.
            v_actual_debit := v_wallet.balance; -- Only debit what remains
            v_new_balance := 0;
            v_description := COALESCE(p_description, '') ||
                ' [DEBT-NOTE: Adjustment exceeded balance. Actual debit clamped to ' ||
                v_wallet.balance::TEXT || '. Remaining debt: ' ||
                (p_amount - v_wallet.balance)::TEXT || ']';
        END IF;
    END IF;

    -- 4. Update the Wallet (if balance changed)
    IF v_new_balance != v_wallet.balance THEN
        UPDATE public.user_wallets
        SET balance = v_new_balance,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    -- 5. Insert Transaction Log (always, even ghost transactions for reporting)
    INSERT INTO public.wallet_transactions (
        user_id,
        type,
        amount,
        balance_after,
        source,
        wa_category,
        wa_conversation_id,
        conversation_expiry,
        wa_message_id,
        description,
        contact_phone,
        campaign_id,
        drip_campaign_id,
        flow_id,
        whatsapp_account_id,
        platform_cost,
        meta_cost
    )
    VALUES (
        p_user_id,
        p_type,
        v_actual_debit,
        v_new_balance,
        p_source,
        p_wa_category,
        p_wa_conversation_id,
        p_conversation_expiry,
        p_wa_message_id,
        v_description,
        p_contact_phone,
        p_campaign_id,
        p_drip_campaign_id,
        p_flow_id,
        p_whatsapp_account_id,
        CASE WHEN p_type = 'DEBIT' AND p_source NOT IN ('ADMIN_TOPUP', 'RECHARGE') THEN v_actual_debit ELSE NULL END,
        p_meta_cost
    )
    RETURNING id INTO v_tx_id;

    -- 6. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_tx_id,
        'new_balance', v_new_balance,
        'clamped', (v_actual_debit != p_amount)
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Standardize error output
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;
