-- Migration: Wallet Architecture V2 RPCs
-- Adds Reservation Hold/Release logic and updates adjust_wallet_balance

-- 1. Hold Campaign Reservation
CREATE OR REPLACE FUNCTION hold_campaign_reservation(
    p_user_id UUID,
    p_amount NUMERIC,
    p_campaign_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT 'Campaign Reservation Hold',
    p_created_by UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_allow_partial BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.user_wallets%ROWTYPE;
    v_new_balance NUMERIC;
    v_new_reserved NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain TEXT;
    v_tx_id UUID;
    v_actual_hold NUMERIC;
    v_is_partial BOOLEAN := FALSE;
BEGIN
    SELECT * INTO v_wallet
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    IF v_wallet.wallet_frozen THEN
        RAISE EXCEPTION 'Wallet is frozen for user_id: %', p_user_id;
    END IF;

    IF v_wallet.wallet_enforced = TRUE AND v_wallet.balance < p_amount THEN
        IF p_allow_partial = TRUE THEN
            v_actual_hold := v_wallet.balance;
            v_is_partial := TRUE;
            p_description := p_description || ' (PARTIAL HOLD)';
        ELSE
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Cannot hold reservation of %. Current balance: %', p_amount, v_wallet.balance;
        END IF;
    ELSE
        v_actual_hold := p_amount;
    END IF;

    -- If actual_hold is 0, we can't send anything.
    IF v_actual_hold <= 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Wallet balance is 0. Cannot hold reservation.';
    END IF;

    v_new_balance := CASE WHEN v_wallet.wallet_enforced THEN v_wallet.balance - v_actual_hold ELSE v_wallet.balance END;
    v_new_reserved := v_wallet.reserved_balance + v_actual_hold;

    IF v_new_balance != v_wallet.balance OR v_new_reserved != v_wallet.reserved_balance THEN
        UPDATE public.user_wallets
        SET balance = v_new_balance,
            reserved_balance = v_new_reserved,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_after, source, description, campaign_id,
        balance_before, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, 'DEBIT', v_actual_hold, v_new_balance, 'RESERVATION_HOLD', p_description, p_campaign_id,
        v_balance_before, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success', true, 
        'transaction_id', v_tx_id, 
        'new_balance', v_new_balance, 
        'new_reserved', v_new_reserved,
        'actual_held', v_actual_hold,
        'is_partial', v_is_partial
    );
END;
$$;

-- 2. Release Campaign Reservation
CREATE OR REPLACE FUNCTION release_campaign_reservation(
    p_user_id UUID,
    p_amount NUMERIC,
    p_campaign_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT 'Campaign Reservation Release',
    p_created_by UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.user_wallets%ROWTYPE;
    v_new_balance NUMERIC;
    v_new_reserved NUMERIC;
    v_actual_release NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain TEXT;
    v_tx_id UUID;
BEGIN
    SELECT * INTO v_wallet
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    -- You can release even if frozen

    v_actual_release := LEAST(p_amount, v_wallet.reserved_balance);
    v_new_balance := CASE WHEN v_wallet.wallet_enforced THEN v_wallet.balance + v_actual_release ELSE v_wallet.balance END;
    v_new_reserved := v_wallet.reserved_balance - v_actual_release;

    IF v_new_balance != v_wallet.balance OR v_new_reserved != v_wallet.reserved_balance THEN
        UPDATE public.user_wallets
        SET balance = v_new_balance,
            reserved_balance = v_new_reserved,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_after, source, description, campaign_id,
        balance_before, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, 'CREDIT', v_actual_release, v_new_balance, 'RESERVATION_RELEASE', p_description, p_campaign_id,
        v_balance_before, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'new_balance', v_new_balance, 'new_reserved', v_new_reserved, 'released_amount', v_actual_release);
END;
$$;

-- 3. Modify adjust_wallet_balance to support CAMPAIGN_SEND deductions from reserved_balance
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
    p_meta_cost NUMERIC DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.user_wallets%ROWTYPE;
    v_new_balance NUMERIC;
    v_new_reserved NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain TEXT;
    v_tx_id UUID;
    v_actual_debit NUMERIC;
    v_description TEXT;
    v_is_adjustment BOOLEAN;
BEGIN
    SELECT * INTO v_wallet
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    IF v_wallet.wallet_frozen AND p_source NOT IN ('ADMIN_TOPUP', 'RECHARGE') THEN
        RAISE EXCEPTION 'Wallet is frozen for user_id: %', p_user_id;
    END IF;

    v_is_adjustment := (p_source IN ('ADJUSTMENT', 'WEBHOOK_SYNC'));
    v_actual_debit := p_amount;
    v_description := p_description;
    v_new_balance := v_wallet.balance;
    v_new_reserved := v_wallet.reserved_balance;

    IF v_wallet.wallet_enforced = TRUE OR p_source IN ('ADMIN_TOPUP', 'RECHARGE') THEN
        IF p_type = 'DEBIT' THEN
            IF p_source = 'CAMPAIGN_SEND' THEN
                IF v_wallet.reserved_balance >= p_amount THEN
                    v_new_reserved := v_wallet.reserved_balance - p_amount;
                ELSE
                    v_new_reserved := 0;
                    v_new_balance := v_wallet.balance - (p_amount - v_wallet.reserved_balance);
                END IF;
            ELSE
                v_new_balance := v_wallet.balance - p_amount;
            END IF;
        ELSIF p_type = 'CREDIT' THEN
            v_new_balance := v_wallet.balance + p_amount;
        ELSE
            RAISE EXCEPTION 'Invalid transaction type: %', p_type;
        END IF;
    END IF;

    -- guards
    IF p_type = 'DEBIT' AND v_wallet.wallet_enforced = TRUE THEN
        IF v_new_balance < 0 THEN
            IF NOT v_is_adjustment THEN
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Enforced mode prevents negative balance. Current: %', v_wallet.balance;
            END IF;

            -- Clamping
            IF p_source = 'CAMPAIGN_SEND' THEN
                -- If somehow campaign exceeded reservation and balance
                v_actual_debit := (v_wallet.balance + v_wallet.reserved_balance);
            ELSE
                v_actual_debit := v_wallet.balance;
            END IF;
            
            v_new_balance := 0;
            v_description := COALESCE(p_description, '') ||
                ' [DEBT-NOTE: Adjustment exceeded balance. Remaining debt: ' ||
                (p_amount - v_actual_debit)::TEXT || ']';
        END IF;
    END IF;

    IF v_new_balance != v_wallet.balance OR v_new_reserved != v_wallet.reserved_balance THEN
        UPDATE public.user_wallets
        SET balance = v_new_balance,
            reserved_balance = v_new_reserved,
            updated_at = now()
        WHERE user_id = p_user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_after, source, wa_category,
        wa_conversation_id, conversation_expiry, wa_message_id, description,
        contact_phone, campaign_id, drip_campaign_id, flow_id, whatsapp_account_id,
        platform_cost, meta_cost, balance_before, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, p_type, v_actual_debit, v_new_balance, p_source, p_wa_category,
        p_wa_conversation_id, p_conversation_expiry, p_wa_message_id, v_description,
        p_contact_phone, p_campaign_id, p_drip_campaign_id, p_flow_id, p_whatsapp_account_id,
        CASE WHEN p_type = 'DEBIT' AND p_source NOT IN ('ADMIN_TOPUP', 'RECHARGE') THEN v_actual_debit ELSE NULL END,
        p_meta_cost, v_balance_before, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id, 'new_balance', v_new_balance, 'new_reserved', v_new_reserved, 'clamped', (v_actual_debit != p_amount));
END;
$$;
