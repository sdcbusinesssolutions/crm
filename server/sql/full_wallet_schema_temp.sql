-- ⚠️ ⚠️ ⚠️  DEPRECATED — DO NOT RUN  ⚠️ ⚠️ ⚠️
-- This is a COMBINED snapshot file that contains OLD RPC versions with the wallet_enforced bypass loophole.
-- Running any of the CREATE OR REPLACE FUNCTION blocks in this file will OVERWRITE the patched, secure RPCs.
-- AUTHORITATIVE PATCHED VERSION: server/sql/wallet_atomic_rpc_v2.sql
-- All table schema migrations are split into: 220_*.sql through 224_*.sql
-- =============================================================================

-- Migration: Wallet Architecture V2
-- Adds reserved balances, wallet freezing, expanded scopes, and new transaction sources.

-- 1. Update user_wallets
ALTER TABLE public.user_wallets
ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
ADD COLUMN IF NOT EXISTS wallet_frozen BOOLEAN DEFAULT false;

-- 2. Update wa_message_rates scope
ALTER TABLE public.wa_message_rates DROP CONSTRAINT IF EXISTS wa_message_rates_scope_check;
ALTER TABLE public.wa_message_rates ADD CONSTRAINT wa_message_rates_scope_check 
    CHECK (scope IN ('GLOBAL', 'WORKSPACE', 'TENANT', 'USER'));

-- 3. Update wallet_transactions source
ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_source_check
    CHECK (source IN (
        'ADMIN_TOPUP',
        'RECHARGE',
        'CAMPAIGN_SEND',
        'DRIP_SEND',
        'FLOW_SEND',
        'INBOX_SEND',
        'API_SEND',
        'REFUND',
        'ADJUSTMENT',
        'WEBHOOK_SYNC',
        'RESERVATION_HOLD',
        'RESERVATION_RELEASE'
    ));
-- Migration: Add WhatsApp Wallet & Billing System

-- 1. Wallet Table (Balance per User)
CREATE TABLE IF NOT EXISTS public.user_wallets (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance NUMERIC(12, 4) DEFAULT 0.0000 NOT NULL,
    currency TEXT DEFAULT 'INR' NOT NULL,
    wallet_enforced BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Wallet Transactions Table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Transaction Type
    type TEXT NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(12, 4) NOT NULL,
    balance_after NUMERIC(12, 4) NOT NULL,
    
    -- What triggered this transaction?
    -- WEBHOOK_SYNC: untracked billable event (playground, coexistence, manual API)
    -- ADJUSTMENT: category changed post-send (e.g. UTILITY -> MARKETING reclassification)
    source TEXT NOT NULL CHECK (source IN (
        'ADMIN_TOPUP',
        'RECHARGE',
        'CAMPAIGN_SEND',
        'DRIP_SEND',
        'FLOW_SEND',
        'INBOX_SEND',
        'API_SEND',
        'REFUND',
        'ADJUSTMENT',
        'WEBHOOK_SYNC'
    )),
    
    -- WhatsApp Billing Details
    -- wa_conversation_id: Meta's conversation window ID (same ID for all messages in a 24h window)
    -- conversation_expiry: When the 24h window closes (from Meta's status.conversation.expiration_timestamp)
    wa_category TEXT CHECK (wa_category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE')),
    wa_conversation_id TEXT,
    conversation_expiry TIMESTAMPTZ,
    wa_message_id TEXT,
    message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    whatsapp_account_id UUID REFERENCES public.whatsapp_config(id) ON DELETE SET NULL,
    
    -- Context
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    drip_campaign_id UUID REFERENCES public.drip_campaigns(id) ON DELETE SET NULL,
    flow_id UUID REFERENCES public.flows(id) ON DELETE SET NULL,
    contact_phone TEXT,
    
    -- Cost Breakdown
    meta_cost NUMERIC(12, 6),
    platform_cost NUMERIC(12, 4),
    markup_percent NUMERIC(5, 2),
    
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON public.wallet_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_source ON public.wallet_transactions(user_id, source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wa_category ON public.wallet_transactions(user_id, wa_category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wa_message_id ON public.wallet_transactions(wa_message_id);
-- Unique index to prevent duplicate 24h window billing (one DEBIT per conversation window per user)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_conversation_dedup
    ON public.wallet_transactions(user_id, wa_conversation_id)
    WHERE type = 'DEBIT' AND source NOT IN ('ADJUSTMENT', 'REFUND', 'ADMIN_TOPUP', 'RECHARGE', 'WEBHOOK_SYNC');

-- 3. Message Cost Rates Table (Admin-Configurable Pricing)
CREATE TABLE IF NOT EXISTS public.wa_message_rates (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('GLOBAL', 'WORKSPACE')),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    category TEXT NOT NULL CHECK (category IN ('MARKETING', 'UTILITY', 'AUTHENTICATION', 'SERVICE')),
    country_code TEXT NOT NULL DEFAULT 'IN',
    
    meta_cost NUMERIC(10, 6) NOT NULL,
    platform_rate NUMERIC(10, 4) NOT NULL,
    currency TEXT DEFAULT 'INR' NOT NULL,
    
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT now(),
    updated_by UUID,
    
    UNIQUE(scope, user_id, category, country_code)
);

-- Seed Global Default Rates
INSERT INTO public.wa_message_rates (scope, user_id, category, country_code, meta_cost, platform_rate)
VALUES
('GLOBAL', NULL, 'MARKETING',       'IN', 0.0128, 0.70),
('GLOBAL', NULL, 'UTILITY',         'IN', 0.0040, 0.22),
('GLOBAL', NULL, 'AUTHENTICATION',  'IN', 0.0040, 0.22),
('GLOBAL', NULL, 'SERVICE',         'IN', 0.0040, 0.20)
ON CONFLICT DO NOTHING;

-- Grant permissions (adjust as needed for RLS)
GRANT ALL ON TABLE public.user_wallets TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.wallet_transactions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.wa_message_rates TO postgres, anon, authenticated, service_role;

-- =============================================================================
-- LIVE DB MIGRATION: Fix missing WEBHOOK_SYNC in source constraint
-- Run this in Supabase SQL Editor if the table already exists:
-- =============================================================================
-- ALTER TABLE wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
-- ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_transactions_source_check
--     CHECK (source IN (
--         'ADMIN_TOPUP','RECHARGE','CAMPAIGN_SEND','DRIP_SEND',
--         'FLOW_SEND','INBOX_SEND','API_SEND','REFUND','ADJUSTMENT','WEBHOOK_SYNC'
--     ));
-- 
-- -- Add conversation window columns for 24-hour deduplication:
-- ALTER TABLE wallet_transactions ADD COLUMN IF NOT EXISTS conversation_expiry TIMESTAMPTZ;
-- 
-- -- Add unique constraint to prevent double-billing same conversation window:
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_conversation_dedup
--     ON wallet_transactions(user_id, wa_conversation_id)
--     WHERE type = 'DEBIT' AND source NOT IN ('ADJUSTMENT','REFUND','ADMIN_TOPUP','RECHARGE','WEBHOOK_SYNC');
--
-- CREATE INDEX IF NOT EXISTS idx_wallet_tx_wa_message_id ON public.wallet_transactions(wa_message_id);
-- ====================================================================================
-- 223_audit_compliance.sql
-- Section 7: Audit & Compliance Schema Modifications
-- ====================================================================================

-- 1. Add new auditing columns to wallet_transactions
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12, 4),
ADD COLUMN IF NOT EXISTS tenant_domain TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 2. Backfill balance_before for existing transactions (best effort approximation)
-- Since we didn't have balance_before, we can approximate it as balance_after - amount (if CREDIT) or + amount (if DEBIT)
UPDATE public.wallet_transactions
SET balance_before = CASE 
    WHEN type = 'CREDIT' THEN balance_after - amount
    WHEN type = 'DEBIT' THEN balance_after + amount
    ELSE balance_after
END
WHERE balance_before IS NULL;

-- 3. Create the Tamper-Proof Trigger Function
CREATE OR REPLACE FUNCTION prevent_wallet_transaction_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- BLOCK ALL DELETES
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'AUDIT COMPLIANCE: Deletion of wallet transactions is strictly forbidden. Please issue a reversing ADJUSTMENT or REFUND transaction.';
    END IF;

    -- RESTRICT UPDATES
    IF TG_OP = 'UPDATE' THEN
        -- Allow updates ONLY if the updated fields are related to Meta 24-hour window deduplication.
        -- Any attempt to change financial fields will trigger this block.
        IF NEW.amount != OLD.amount OR 
           NEW.balance_before != OLD.balance_before OR 
           NEW.balance_after != OLD.balance_after OR 
           NEW.type != OLD.type OR 
           NEW.source != OLD.source OR
           NEW.user_id != OLD.user_id OR
           NEW.created_at != OLD.created_at
        THEN
            RAISE EXCEPTION 'AUDIT COMPLIANCE: Modification of financial fields in wallet transactions is strictly forbidden. Please issue a reversing ADJUSTMENT or REFUND transaction.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply the Trigger
DROP TRIGGER IF EXISTS trg_prevent_wallet_transaction_tampering ON public.wallet_transactions;
CREATE TRIGGER trg_prevent_wallet_transaction_tampering
BEFORE UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW
EXECUTE FUNCTION prevent_wallet_transaction_tampering();
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
-- ====================================================================================
-- 222_reporting_functions.sql
-- Financial & Usage Reporting Aggregations (Section 6.2)
-- ====================================================================================

-- 1. Revenue Report
-- Aggregates revenue, meta costs, and total debits over a time range.
-- Can be grouped by: 'tenant', 'user', 'campaign', 'waba', 'category'
CREATE OR REPLACE FUNCTION get_revenue_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_group_by TEXT, -- 'tenant', 'user', 'campaign', 'category', 'source'
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    group_key TEXT,
    total_debited NUMERIC,
    total_meta_cost NUMERIC,
    total_platform_revenue NUMERIC,
    transaction_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN p_group_by = 'user' THEN t.user_id::TEXT
            WHEN p_group_by = 'tenant' THEN p.signup_domain::TEXT
            WHEN p_group_by = 'campaign' THEN t.campaign_id::TEXT
            WHEN p_group_by = 'category' THEN t.wa_category::TEXT
            WHEN p_group_by = 'source' THEN t.source::TEXT
            ELSE 'ALL'
        END AS group_key,
        SUM(t.amount) AS total_debited,
        SUM(COALESCE(t.meta_cost, 0)) AS total_meta_cost,
        SUM(COALESCE(t.platform_cost, 0)) AS total_platform_revenue,
        COUNT(t.id) AS transaction_count
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain)
    GROUP BY 1
    ORDER BY total_debited DESC;
END;
$$;


-- 2. Usage Volume Report
-- Aggregates message counts and conversation counts over intervals (daily, weekly, monthly)
CREATE OR REPLACE FUNCTION get_usage_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_interval TEXT, -- 'day', 'week', 'month'
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    interval_start TIMESTAMPTZ,
    messages_sent BIGINT,
    conversations_created BIGINT,
    marketing_count BIGINT,
    utility_count BIGINT,
    service_count BIGINT,
    ai_calls BIGINT,
    voice_calls BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        date_trunc(p_interval, t.created_at) AS interval_start,
        COUNT(t.id) AS messages_sent,
        COUNT(DISTINCT t.wa_conversation_id) AS conversations_created,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'MARKETING') AS marketing_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'UTILITY') AS utility_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'SERVICE') AS service_count,
        -- Dynamically tracking AI and Voice based on generic source or category markers
        COUNT(t.id) FILTER (WHERE t.source IN ('AI_CHAT', 'AI_CALL') OR t.wa_category = 'AI_CALL') AS ai_calls,
        COUNT(t.id) FILTER (WHERE t.source = 'VOICE' OR t.wa_category = 'VOICE_CALL') AS voice_calls
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain)
    GROUP BY 1
    ORDER BY 1 ASC;
END;
$$;


-- 3. Wallet Financial Summary Report
-- Calculates opening, added, consumed, refunds, and closing over a period for a tenant or globally.
CREATE OR REPLACE FUNCTION get_wallet_summary_report(
    p_start_date TIMESTAMPTZ,
    p_end_date TIMESTAMPTZ,
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_added NUMERIC,
    total_consumed NUMERIC,
    total_refunded NUMERIC,
    total_adjusted NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source IN ('ADMIN_TOPUP', 'RECHARGE')) AS total_added,
        SUM(t.amount) FILTER (WHERE t.type = 'DEBIT') AS total_consumed,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'REFUND') AS total_refunded,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'ADJUSTMENT') AS total_adjusted
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE (p_start_date IS NULL OR t.created_at >= p_start_date)
      AND (p_end_date IS NULL OR t.created_at <= p_end_date)
      AND (p_tenant_domain IS NULL OR p.signup_domain = p_tenant_domain);
END;
$$;
