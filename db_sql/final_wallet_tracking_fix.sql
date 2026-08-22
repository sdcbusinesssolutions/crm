-- ==============================================================================
-- ZERO LOSS ARCHITECTURE & TRACKING MODE FIX
-- This file combines the updates for hold_campaign_reservation and 
-- adjust_wallet_balance to properly support Tracking Mode (Negative Balances)
-- ==============================================================================

-- 1. CAMPAIGN RESERVATION HOLD (TRACKING MODE SUPPORT)
CREATE OR REPLACE FUNCTION hold_campaign_reservation(
    p_user_id UUID,
    p_amount NUMERIC,
    p_campaign_id UUID,
    p_description TEXT,
    p_allow_partial BOOLEAN DEFAULT FALSE
) RETURNS TABLE (
    success BOOLEAN,
    actual_held NUMERIC,
    is_partial BOOLEAN
) AS $$
DECLARE
    v_available NUMERIC;
    v_wallet_id UUID;
    v_actual_amount NUMERIC;
    v_is_partial BOOLEAN := FALSE;
    v_wallet_enforced BOOLEAN;
BEGIN
    -- Use FOR UPDATE to prevent race conditions from concurrent campaigns
    SELECT id, (balance - reserved_balance), wallet_enforced INTO v_wallet_id, v_available, v_wallet_enforced
    FROM user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF v_wallet_id IS NULL THEN
        RAISE EXCEPTION 'Wallet not found for user';
    END IF;

    -- If in Tracking Mode (wallet_enforced = FALSE), bypass balance checks
    IF v_wallet_enforced = FALSE THEN
        v_actual_amount := p_amount;
    ELSE
        IF v_available <= 0 THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
        END IF;

        IF v_available < p_amount THEN
            IF p_allow_partial THEN
                v_actual_amount := v_available;
                v_is_partial := TRUE;
            ELSE
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
            END IF;
        ELSE
            v_actual_amount := p_amount;
        END IF;
    END IF;

    -- Move from balance to reserved_balance 
    UPDATE user_wallets
    SET reserved_balance = reserved_balance + v_actual_amount
    WHERE id = v_wallet_id;

    -- Record transaction
    INSERT INTO wallet_transactions (
        user_id, amount, type, source, description, campaign_id
    ) VALUES (
        p_user_id, v_actual_amount, 'RESERVE', 'RESERVATION_HOLD', p_description, p_campaign_id
    );

    RETURN QUERY SELECT TRUE, v_actual_amount, v_is_partial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 2. ADJUST WALLET BALANCE (TRACKING MODE SUPPORT)
-- ==============================================================================
CREATE OR REPLACE FUNCTION adjust_wallet_balance(
    p_user_id             UUID,
    p_amount              NUMERIC,
    p_type                TEXT,
    p_source              TEXT,
    p_wa_category         TEXT        DEFAULT NULL,
    p_wa_message_id       TEXT        DEFAULT NULL,
    p_wa_conversation_id  TEXT        DEFAULT NULL,
    p_conversation_expiry TIMESTAMPTZ DEFAULT NULL,
    p_description         TEXT        DEFAULT NULL,
    p_contact_phone       TEXT        DEFAULT NULL,
    p_campaign_id         UUID        DEFAULT NULL,
    p_drip_campaign_id    UUID        DEFAULT NULL,
    p_flow_id             UUID        DEFAULT NULL,
    p_whatsapp_account_id UUID        DEFAULT NULL,
    p_meta_cost           NUMERIC     DEFAULT NULL,
    p_created_by          UUID        DEFAULT NULL,
    p_ip_address          TEXT        DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet         public.user_wallets%ROWTYPE;
    v_new_balance    NUMERIC;
    v_new_reserved   NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain  TEXT;
    v_tx_id          UUID;
    v_actual_debit   NUMERIC;
    v_description    TEXT;
    v_is_adjustment  BOOLEAN;
BEGIN
    SELECT * INTO v_wallet FROM public.user_wallets
        WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero. Got: %', p_amount;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    IF v_wallet.wallet_frozen AND p_source NOT IN ('ADMIN_TOPUP', 'RECHARGE') THEN
        RAISE EXCEPTION 'Wallet is frozen for user_id: %', p_user_id;
    END IF;

    v_is_adjustment := (p_source IN ('ADJUSTMENT', 'WEBHOOK_SYNC'));
    v_actual_debit  := p_amount;
    v_description   := p_description;
    v_new_balance   := v_wallet.balance;
    v_new_reserved  := v_wallet.reserved_balance;

    IF p_type = 'DEBIT' THEN
        IF p_source = 'CAMPAIGN_SEND' THEN
            IF v_wallet.reserved_balance >= p_amount THEN
                v_new_reserved := v_wallet.reserved_balance - p_amount;
            ELSE
                v_new_reserved := 0;
                v_new_balance  := v_wallet.balance - (p_amount - v_wallet.reserved_balance);
            END IF;
        ELSE
            v_new_balance := v_wallet.balance - p_amount;
        END IF;
    ELSIF p_type = 'CREDIT' THEN
        v_new_balance := v_wallet.balance + p_amount;
    ELSE
        RAISE EXCEPTION 'Invalid transaction type: %. Must be CREDIT or DEBIT.', p_type;
    END IF;

    -- ── Guard: prevent negative balance ─────────────────────
    IF p_type = 'DEBIT' AND v_new_balance < 0 THEN
        IF v_wallet.wallet_enforced = TRUE AND NOT v_is_adjustment THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Balance cannot go negative. Current: %, Requested debit: %', v_wallet.balance, p_amount;
        END IF;
        
        -- If wallet IS enforced and it's an adjustment, clamp to zero.
        -- If wallet is NOT enforced (Tracking Mode), DO NOT clamp, let it go negative!
        IF v_wallet.wallet_enforced = TRUE AND v_is_adjustment THEN
            IF p_source = 'CAMPAIGN_SEND' THEN
                v_actual_debit := (v_wallet.balance + v_wallet.reserved_balance);
            ELSE
                v_actual_debit := v_wallet.balance;
            END IF;
            v_new_balance := 0;
            v_description := COALESCE(p_description, '') ||
                ' [DEBT-NOTE: Adjustment exceeded balance. Unrecovered: ' ||
                (p_amount - v_actual_debit)::TEXT || ']';
        END IF;
    END IF;

    -- ── Commit balance ───────────────────────────────────────────────────────
    IF v_new_balance != v_wallet.balance OR v_new_reserved != v_wallet.reserved_balance THEN
        UPDATE public.user_wallets
            SET balance          = v_new_balance,
                reserved_balance = v_new_reserved,
                updated_at       = now()
            WHERE user_id = p_user_id;
    END IF;

    -- ── Write immutable ledger row ───────────────────────────────────────────
    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        source, wa_category, wa_conversation_id, conversation_expiry,
        wa_message_id, description, contact_phone,
        campaign_id, drip_campaign_id, flow_id, whatsapp_account_id,
        platform_cost, meta_cost, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, p_type, v_actual_debit, v_balance_before, v_new_balance,
        p_source, p_wa_category, p_wa_conversation_id, p_conversation_expiry,
        p_wa_message_id, v_description, p_contact_phone,
        p_campaign_id, p_drip_campaign_id, p_flow_id, p_whatsapp_account_id,
        CASE WHEN p_type = 'DEBIT' AND p_source NOT IN ('ADMIN_TOPUP','RECHARGE') THEN v_actual_debit ELSE NULL END,
        p_meta_cost, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success',        TRUE,
        'transaction_id', v_tx_id,
        'new_balance',    v_new_balance,
        'new_reserved',   v_new_reserved
    );
END;
$$;
