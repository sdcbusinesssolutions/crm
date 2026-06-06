-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 221: Atomic Reseller Transfer Function
-- Safely moves credits from Tenant Admin Master Wallet → Target User Wallet
-- Uses row-level locking to prevent race conditions.
-- Run in Supabase SQL Editor AFTER 220_hybrid_billing_modes.sql
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION transfer_reseller_balance(
    p_tenant_admin_user_id  UUID,       -- Tenant Admin being debited
    p_target_user_id        UUID,       -- End user being credited
    p_amount                NUMERIC,    -- Amount to transfer
    p_description           TEXT DEFAULT NULL,
    p_created_by            UUID DEFAULT NULL,
    p_ip_address            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_master_wallet     public.user_wallets%ROWTYPE;
    v_target_wallet     public.user_wallets%ROWTYPE;
    v_master_new_bal    NUMERIC;
    v_target_new_bal    NUMERIC;
    v_master_bal_before NUMERIC;
    v_target_bal_before NUMERIC;
    v_master_domain     TEXT;
    v_target_domain     TEXT;
    v_debit_tx_id       UUID;
    v_credit_tx_id      UUID;
    v_desc              TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive. Got: %', p_amount;
    END IF;

    -- ── Lock both wallets in consistent order (lower UUID first) to prevent deadlock ──
    IF p_tenant_admin_user_id < p_target_user_id THEN
        SELECT * INTO v_master_wallet FROM public.user_wallets
            WHERE user_id = p_tenant_admin_user_id AND is_tenant_master = TRUE FOR UPDATE;
        SELECT * INTO v_target_wallet FROM public.user_wallets
            WHERE user_id = p_target_user_id FOR UPDATE;
    ELSE
        SELECT * INTO v_target_wallet FROM public.user_wallets
            WHERE user_id = p_target_user_id FOR UPDATE;
        SELECT * INTO v_master_wallet FROM public.user_wallets
            WHERE user_id = p_tenant_admin_user_id AND is_tenant_master = TRUE FOR UPDATE;
    END IF;

    -- ── Guard: Master Wallet must exist ──
    IF NOT FOUND OR v_master_wallet.user_id IS NULL THEN
        RAISE EXCEPTION 'MASTER_WALLET_NOT_FOUND: Tenant Admin % does not have a Master Wallet.', p_tenant_admin_user_id;
    END IF;

    -- ── Guard: Create target wallet if missing ──
    IF v_target_wallet.user_id IS NULL THEN
        INSERT INTO public.user_wallets (user_id) VALUES (p_target_user_id)
            ON CONFLICT (user_id) DO NOTHING
            RETURNING * INTO v_target_wallet;
        -- Refetch after insert
        SELECT * INTO v_target_wallet FROM public.user_wallets
            WHERE user_id = p_target_user_id FOR UPDATE;
    END IF;

    -- ── Guard: Sufficient Master Wallet balance ──
    IF v_master_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_AGENCY_BALANCE: Master Wallet balance is ₹%. Tried to transfer ₹%.', v_master_wallet.balance, p_amount;
    END IF;

    v_master_bal_before := v_master_wallet.balance;
    v_target_bal_before := v_target_wallet.balance;

    SELECT signup_domain INTO v_master_domain FROM public.profiles WHERE id = p_tenant_admin_user_id;
    SELECT signup_domain INTO v_target_domain FROM public.profiles WHERE id = p_target_user_id;

    v_master_new_bal := v_master_wallet.balance - p_amount;
    v_target_new_bal := v_target_wallet.balance + p_amount;
    v_desc := COALESCE(p_description, 'Reseller top-up from Agency Master Wallet');

    -- ── Debit Master Wallet ──
    UPDATE public.user_wallets
        SET balance = v_master_new_bal, updated_at = now()
        WHERE user_id = p_tenant_admin_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_after, source, description,
        balance_before, tenant_domain, created_by, ip_address
    ) VALUES (
        p_tenant_admin_user_id, 'DEBIT', p_amount, v_master_new_bal, 'ADMIN_TOPUP',
        'Agency Master Wallet: Transferred ₹' || p_amount || ' to user ' || p_target_user_id,
        v_master_bal_before, v_master_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_debit_tx_id;

    -- ── Credit Target User ──
    UPDATE public.user_wallets
        SET balance = v_target_new_bal, updated_at = now()
        WHERE user_id = p_target_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_after, source, description,
        balance_before, tenant_domain, created_by, ip_address
    ) VALUES (
        p_target_user_id, 'CREDIT', p_amount, v_target_new_bal, 'ADMIN_TOPUP',
        v_desc || ' (from Agency Master Wallet)',
        v_target_bal_before, v_target_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_credit_tx_id;

    RETURN jsonb_build_object(
        'success',              true,
        'debit_tx_id',          v_debit_tx_id,
        'credit_tx_id',         v_credit_tx_id,
        'master_new_balance',   v_master_new_bal,
        'user_new_balance',     v_target_new_bal
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION '%', SQLERRM;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- Helper: Initialize or Get Tenant Admin Master Wallet
-- Called once when a Tenant Admin is assigned to a domain.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION ensure_tenant_master_wallet(p_tenant_admin_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet public.user_wallets%ROWTYPE;
BEGIN
    SELECT * INTO v_wallet FROM public.user_wallets
        WHERE user_id = p_tenant_admin_user_id AND is_tenant_master = TRUE;

    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, is_tenant_master, billing_mode)
            VALUES (p_tenant_admin_user_id, TRUE, 'CREDIT_LINE_TENANT')
            ON CONFLICT (user_id) DO UPDATE
                SET is_tenant_master = TRUE
            RETURNING * INTO v_wallet;
    END IF;

    RETURN jsonb_build_object('wallet_id', v_wallet.id, 'balance', v_wallet.balance);
END;
$$;
