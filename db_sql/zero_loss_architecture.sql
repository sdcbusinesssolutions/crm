-- Zero-Loss Enterprise Campaign Architecture Migration

-- 1. Add required columns to campaigns table for persistent locking and batch tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS locked_category TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS locked_rate NUMERIC;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS safe_batch_size INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS safe_batch_deducted NUMERIC;

-- 2. Update hold_campaign_reservation to handle high-concurrency race conditions
-- This RPC safely locks funds for the Safe Batch using row-level locking (FOR UPDATE)
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

    -- If in Tracking Mode, bypass balance checks
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

    -- Move from balance to reserved_balance (Note: actual deduction happens during webhook)
    -- In some architectures, balance is deducted AND reserved_balance increases.
    -- Assuming balance includes reserved_balance in this system, so available is (balance - reserved_balance)
    UPDATE user_wallets
    SET reserved_balance = reserved_balance + v_actual_amount
    WHERE id = v_wallet_id;

    -- Record transaction
    INSERT INTO wallet_transactions (
        user_id,
        amount,
        type,
        source,
        description,
        campaign_id
    ) VALUES (
        p_user_id,
        v_actual_amount,
        'RESERVE',
        'RESERVATION_HOLD',
        p_description,
        p_campaign_id
    );

    RETURN QUERY SELECT TRUE, v_actual_amount, v_is_partial;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
