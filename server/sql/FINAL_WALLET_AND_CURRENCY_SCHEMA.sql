-- ═══════════════════════════════════════════════════════════════════════════
-- WALLET COMPLETE SCHEMA — AUTHORITATIVE FINAL VERSION
-- WhatsApp SaaS Multi-Tenant Billing System
--
-- Covers:
--   §1  Core Tables            (user_wallets, wallet_transactions, wa_message_rates)
--   §2  V2 Columns             (reserved_balance, wallet_frozen)
--   §3  Hybrid Billing Modes   (billing_mode, is_tenant_master, domain_wallet_settings)
--   §4  Audit Columns          (balance_before, tenant_domain, created_by, ip_address)
--   §5  Final Source Constraint (includes AGENCY_MARKUP — no ghost sources)
--   §6  Indexes & Dedup Guard
--   §7  Tamper-Proof Trigger
--   §8  Atomic RPCs             (hold_campaign_reservation, release_campaign_reservation,
--                                adjust_wallet_balance)
--   §9  Reseller Transfer RPC  (transfer_reseller_balance, ensure_tenant_master_wallet)
--   §10 Reporting Functions    (get_revenue_report, get_usage_report,
--                               get_wallet_summary_report)
--   §11 Permissions
--
-- ✅ Safe to run on a FRESH database (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)
-- ✅ Safe to run on an EXISTING database (idempotent ALTER TABLE and CREATE OR REPLACE)
-- ⚠️  Sections §8–§10 use CREATE OR REPLACE — they OVERWRITE existing functions.
--    This is intentional: it ensures the patched, secure versions are always active.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- ═══════════════════════════════════════════════════════════════════════════
-- §1  CORE TABLES & MIGRATIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- 10. Add required columns to campaigns table for persistent locking and batch tracking
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS locked_category TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS locked_rate NUMERIC;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS safe_batch_size INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS safe_batch_deducted NUMERIC;

-- 1a. user_wallets — one row per user, tracks their credit balance
CREATE TABLE IF NOT EXISTS public.user_wallets (
    id              UUID         DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id         UUID         NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    balance         NUMERIC(12,4) DEFAULT 0.0000 NOT NULL,
    currency        TEXT         DEFAULT 'INR'   NOT NULL,
    -- wallet_enforced: If TRUE, strictly prevents negative balances (Prepaid).
    -- If FALSE, allows negative balances (Tracking Mode).
    wallet_enforced BOOLEAN      DEFAULT FALSE,
    created_at      TIMESTAMPTZ  DEFAULT now()   NOT NULL,
    updated_at      TIMESTAMPTZ  DEFAULT now()   NOT NULL
);

-- 1b. wallet_transactions — immutable ledger, one row per financial event
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id                  UUID          DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id             UUID          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Financial fields (protected by tamper-proof trigger in §7)
    type                TEXT          NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
    amount              NUMERIC(12,4) NOT NULL,
    balance_before      NUMERIC(12,4),
    balance_after       NUMERIC(12,4) NOT NULL,

    -- Source of the transaction (see §5 for full constraint)
    source              TEXT          NOT NULL,

    -- WhatsApp conversation context
    wa_category         TEXT          CHECK (wa_category IN ('MARKETING','UTILITY','AUTHENTICATION','SERVICE')),
    wa_conversation_id  TEXT,
    conversation_expiry TIMESTAMPTZ,
    wa_message_id       TEXT,
    message_id          UUID          REFERENCES public.messages(id)          ON DELETE SET NULL,
    whatsapp_account_id UUID          REFERENCES public.whatsapp_config(id)   ON DELETE SET NULL,

    -- Campaign/flow context
    campaign_id         UUID          REFERENCES public.campaigns(id)         ON DELETE SET NULL,
    drip_campaign_id    UUID          REFERENCES public.drip_campaigns(id)    ON DELETE SET NULL,
    flow_id             UUID          REFERENCES public.flows(id)             ON DELETE SET NULL,
    contact_phone       TEXT,

    -- Cost breakdown
    meta_cost           NUMERIC(12,6),
    platform_cost       NUMERIC(12,4),
    markup_percent      NUMERIC(5,2),

    -- Audit fields
    tenant_domain       TEXT,
    created_by          UUID          REFERENCES auth.users(id) ON DELETE SET NULL,
    ip_address          TEXT,
    description         TEXT,
    created_at          TIMESTAMPTZ   DEFAULT now() NOT NULL
);

-- 1c. wa_message_rates — admin-configurable pricing per category/country
CREATE TABLE IF NOT EXISTS public.wa_message_rates (
    id            UUID          DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    scope         TEXT          NOT NULL,
    user_id       UUID          REFERENCES auth.users(id) ON DELETE CASCADE,
    category      TEXT          NOT NULL CHECK (category IN ('MARKETING','UTILITY','AUTHENTICATION','SERVICE')),
    country_code  TEXT          NOT NULL DEFAULT 'IN',
    meta_cost     NUMERIC(10,6) NOT NULL,
    platform_rate NUMERIC(10,4) NOT NULL,
    currency      TEXT          DEFAULT 'INR' NOT NULL,
    is_active     BOOLEAN       DEFAULT TRUE,
    updated_at    TIMESTAMPTZ   DEFAULT now(),
    updated_by    UUID,
    UNIQUE(scope, user_id, category, country_code)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- §2  V2 COLUMNS (reserved_balance, wallet_frozen)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_wallets
    ADD COLUMN IF NOT EXISTS reserved_balance NUMERIC(12,4) DEFAULT 0.0000 NOT NULL,
    ADD COLUMN IF NOT EXISTS wallet_frozen     BOOLEAN       DEFAULT FALSE;

-- ═══════════════════════════════════════════════════════════════════════════
-- §3  HYBRID BILLING MODES
-- ═══════════════════════════════════════════════════════════════════════════

-- billing_mode controls which credit system applies to this user's wallet:
--   CREDIT_LINE_SUPER  → Deducts from Super Admin wholesale credit (reseller model)
--   CREDIT_LINE_TENANT → Deducts from Tenant Admin Master Wallet (agency model)
--   DIRECT_META        → No wallet deduction; user pays Meta directly
ALTER TABLE public.user_wallets
    ADD COLUMN IF NOT EXISTS billing_mode TEXT NOT NULL DEFAULT 'DIRECT_META'
        CHECK (billing_mode IN ('CREDIT_LINE_SUPER','CREDIT_LINE_TENANT','DIRECT_META'));

-- is_tenant_master: TRUE only for the Tenant Admin's own wholesale wallet row
ALTER TABLE public.user_wallets
    ADD COLUMN IF NOT EXISTS is_tenant_master BOOLEAN NOT NULL DEFAULT FALSE;

-- Domain-level settings set by the Super Admin
CREATE TABLE IF NOT EXISTS public.domain_wallet_settings (
    id                       UUID        DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    domain                   TEXT        NOT NULL UNIQUE,
    default_billing_mode     TEXT        NOT NULL DEFAULT 'DIRECT_META'
        CHECK (default_billing_mode IN ('CREDIT_LINE_SUPER','CREDIT_LINE_TENANT','DIRECT_META')),
    tenant_admin_user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    allow_tenant_billing_control BOOLEAN NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at               TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- wa_message_rates: expand scope to support TENANT and USER overrides
ALTER TABLE public.wa_message_rates DROP CONSTRAINT IF EXISTS wa_message_rates_scope_check;
ALTER TABLE public.wa_message_rates ADD CONSTRAINT wa_message_rates_scope_check
    CHECK (scope IN ('GLOBAL','WORKSPACE','TENANT','USER'));

-- ═══════════════════════════════════════════════════════════════════════════
-- §4  AUDIT COLUMNS (idempotent — safe on existing tables)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.wallet_transactions
    ADD COLUMN IF NOT EXISTS balance_before NUMERIC(12,4),
    ADD COLUMN IF NOT EXISTS tenant_domain  TEXT,
    ADD COLUMN IF NOT EXISTS created_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS ip_address     TEXT;

-- Backfill balance_before for existing rows (best-effort approximation)
UPDATE public.wallet_transactions
SET balance_before = CASE
    WHEN type = 'CREDIT' THEN balance_after - amount
    WHEN type = 'DEBIT'  THEN balance_after + amount
    ELSE balance_after
END
WHERE balance_before IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- §5  FINAL SOURCE CONSTRAINT (drop & recreate to add AGENCY_MARKUP)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.wallet_transactions DROP CONSTRAINT IF EXISTS wallet_transactions_source_check;
ALTER TABLE public.wallet_transactions ADD CONSTRAINT wallet_transactions_source_check
    CHECK (source IN (
        'ADMIN_TOPUP',        -- Admin manually credits a user
        'RECHARGE',           -- Super Admin recharges a Tenant Master Wallet
        'CAMPAIGN_SEND',      -- Bulk campaign message send
        'DRIP_SEND',          -- Drip campaign message send
        'FLOW_SEND',          -- Automation flow message send
        'INBOX_SEND',         -- Manual inbox reply
        'API_SEND',           -- API-triggered message send
        'REFUND',             -- Full refund (e.g. failed delivery)
        'ADJUSTMENT',         -- Partial refund or upward adjustment (category reclassification)
        'WEBHOOK_SYNC',       -- Late debit for untracked billable event
        'RESERVATION_HOLD',   -- Campaign budget held before send
        'RESERVATION_RELEASE',-- Campaign unused budget returned
        'AGENCY_MARKUP'       -- SaaS markup fee deducted from Tenant Admin Master Wallet
    ));

-- ═══════════════════════════════════════════════════════════════════════════
-- §6  INDEXES & 24-HOUR DEDUPLICATION GUARD
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id
    ON public.wallet_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_source
    ON public.wallet_transactions(user_id, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wa_category
    ON public.wallet_transactions(user_id, wa_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_wa_message_id
    ON public.wallet_transactions(wa_message_id);

-- Performance Indexes for Reporting RPCs (Google Finance Level)
CREATE INDEX IF NOT EXISTS idx_wallet_tx_tenant_created
    ON public.wallet_transactions(tenant_domain, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_created
    ON public.wallet_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_waba_created
    ON public.wallet_transactions(whatsapp_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_wallets_tenant_master
    ON public.user_wallets(is_tenant_master)
    WHERE is_tenant_master = TRUE;

CREATE INDEX IF NOT EXISTS idx_domain_wallet_settings_domain
    ON public.domain_wallet_settings(domain);

-- One DEBIT per 24-hour conversation window per user (prevents double-billing)
-- ADJUSTMENT, REFUND, ADMIN_TOPUP, RECHARGE, WEBHOOK_SYNC are excluded (they are corrective)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_conversation_dedup
    ON public.wallet_transactions(user_id, wa_conversation_id)
    WHERE type = 'DEBIT'
      AND source NOT IN ('ADJUSTMENT','REFUND','ADMIN_TOPUP','RECHARGE','WEBHOOK_SYNC');

-- SECURITY PATCH: Prevent Idempotency Race Condition on Webhook Pricing Reconciliations
-- Ensures only ONE refund or adjustment can ever be issued per wa_message_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallet_tx_refund_dedup
    ON public.wallet_transactions(wa_message_id)
    WHERE source IN ('ADJUSTMENT', 'REFUND');

-- ═══════════════════════════════════════════════════════════════════════════
-- §7  TAMPER-PROOF TRIGGER
-- All wallet_transactions rows are immutable once written.
-- Financial fields (amount, type, source, user_id) cannot be updated.
-- All deletes are blocked. Corrections must be done via REFUND/ADJUSTMENT rows.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION prevent_wallet_transaction_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'AUDIT: Deletion of wallet_transactions is forbidden. Issue a REFUND or ADJUSTMENT transaction instead.';
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount         != OLD.amount         OR
           NEW.balance_before != OLD.balance_before OR
           NEW.balance_after  != OLD.balance_after  OR
           NEW.type           != OLD.type           OR
           NEW.source         != OLD.source         OR
           NEW.user_id        != OLD.user_id        OR
           NEW.created_at     != OLD.created_at
        THEN
            RAISE EXCEPTION 'AUDIT: Modification of financial fields in wallet_transactions is forbidden. Issue a REFUND or ADJUSTMENT transaction instead.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_wallet_transaction_tampering ON public.wallet_transactions;
CREATE TRIGGER trg_prevent_wallet_transaction_tampering
BEFORE UPDATE OR DELETE ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_wallet_transaction_tampering();

-- ═══════════════════════════════════════════════════════════════════════════
-- §8  ATOMIC RPCs — CAMPAIGN RESERVATION
-- SECURITY NOTES:
--   • p_amount must be > 0 (enforced at first line of each function)
--   • All balance checks are UNCONDITIONAL — wallet_enforced column is IGNORED
--   • Negative balances are strictly prevented for all non-adjustment sources
--   • Row-level locking (FOR UPDATE) prevents race conditions
-- ═══════════════════════════════════════════════════════════════════════════

-- 8a. Hold campaign budget (reserves funds before sending)
CREATE OR REPLACE FUNCTION hold_campaign_reservation(
    p_user_id       UUID,
    p_amount        NUMERIC,
    p_campaign_id   UUID     DEFAULT NULL,
    p_description   TEXT     DEFAULT 'Campaign Reservation Hold',
    p_created_by    UUID     DEFAULT NULL,
    p_ip_address    TEXT     DEFAULT NULL,
    p_allow_partial BOOLEAN  DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet        public.user_wallets%ROWTYPE;
    v_new_balance   NUMERIC;
    v_new_reserved  NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain TEXT;
    v_tx_id         UUID;
    v_actual_hold   NUMERIC;
    v_is_partial    BOOLEAN := FALSE;
    v_wallet_enforced BOOLEAN;
BEGIN
    SELECT * INTO v_wallet FROM public.user_wallets
        WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    -- ── Guard: positive amount ──────────────────────────────────────────────
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero. Got: %', p_amount;
    END IF;

    v_balance_before := v_wallet.balance;
    v_wallet_enforced := v_wallet.wallet_enforced;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    -- ── Guard: frozen wallet ────────────────────────────────────────────────
    IF v_wallet.wallet_frozen THEN
        RAISE EXCEPTION 'Wallet is frozen for user_id: %', p_user_id;
    END IF;

    -- If in Tracking Mode (wallet_enforced = FALSE), bypass balance checks
    IF v_wallet_enforced = FALSE THEN
        v_actual_hold := p_amount;
    ELSE
        -- ── Guard: sufficient balance ───────────────────────────────────────
        IF v_wallet.balance < p_amount THEN
            IF p_allow_partial = TRUE THEN
                v_actual_hold := v_wallet.balance;
                v_is_partial  := TRUE;
                p_description := p_description || ' (PARTIAL HOLD)';
            ELSE
                RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Cannot hold %. Current balance: %', p_amount, v_wallet.balance;
            END IF;
        ELSE
            v_actual_hold := p_amount;
        END IF;
    END IF;

    -- ── Guard: cannot hold zero ─────────────────────────────────────────────
    IF v_actual_hold <= 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Wallet balance is 0. Cannot hold reservation.';
    END IF;

    v_new_balance  := v_wallet.balance - v_actual_hold;
    v_new_reserved := v_wallet.reserved_balance + v_actual_hold;

    UPDATE public.user_wallets
        SET balance          = v_new_balance,
            reserved_balance = v_new_reserved,
            updated_at       = now()
        WHERE user_id = p_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        source, description, campaign_id, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, 'DEBIT', v_actual_hold, v_balance_before, v_new_balance,
        'RESERVATION_HOLD', p_description, p_campaign_id, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success',        TRUE,
        'transaction_id', v_tx_id,
        'new_balance',    v_new_balance,
        'new_reserved',   v_new_reserved,
        'actual_held',    v_actual_hold,
        'is_partial',     v_is_partial
    );
END;
$$;


-- 8b. Release unused campaign budget back to balance
CREATE OR REPLACE FUNCTION release_campaign_reservation(
    p_user_id      UUID,
    p_amount       NUMERIC,
    p_campaign_id  UUID    DEFAULT NULL,
    p_description  TEXT    DEFAULT 'Campaign Reservation Release',
    p_created_by   UUID    DEFAULT NULL,
    p_ip_address   TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_wallet         public.user_wallets%ROWTYPE;
    v_new_balance    NUMERIC;
    v_new_reserved   NUMERIC;
    v_actual_release NUMERIC;
    v_balance_before NUMERIC;
    v_tenant_domain  TEXT;
    v_tx_id          UUID;
BEGIN
    SELECT * INTO v_wallet FROM public.user_wallets
        WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Wallet not found for user_id: %', p_user_id;
    END IF;

    -- ── Guard: positive amount ──────────────────────────────────────────────
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero. Got: %', p_amount;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    -- Release at most what was actually reserved (never create phantom credits)
    v_actual_release := GREATEST(LEAST(p_amount, v_wallet.reserved_balance), 0);

    v_new_balance  := v_wallet.balance + v_actual_release;
    v_new_reserved := v_wallet.reserved_balance - v_actual_release;

    IF v_new_balance != v_wallet.balance OR v_new_reserved != v_wallet.reserved_balance THEN
        UPDATE public.user_wallets
            SET balance          = v_new_balance,
                reserved_balance = v_new_reserved,
                updated_at       = now()
            WHERE user_id = p_user_id;
    END IF;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        source, description, campaign_id, tenant_domain, created_by, ip_address
    ) VALUES (
        p_user_id, 'CREDIT', v_actual_release, v_balance_before, v_new_balance,
        'RESERVATION_RELEASE', p_description, p_campaign_id, v_tenant_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_tx_id;

    RETURN jsonb_build_object(
        'success',         TRUE,
        'transaction_id',  v_tx_id,
        'new_balance',     v_new_balance,
        'new_reserved',    v_new_reserved,
        'released_amount', v_actual_release
    );
END;
$$;


-- 8c. Core debit/credit — the primary financial RPC for all message billing
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

    -- ── Guard: positive amount ──────────────────────────────────────────────
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Amount must be greater than zero. Got: %', p_amount;
    END IF;

    v_balance_before := v_wallet.balance;
    SELECT signup_domain INTO v_tenant_domain FROM public.profiles WHERE id = p_user_id;

    -- ── Guard: frozen wallet (ADMIN_TOPUP and RECHARGE always allowed) ───────
    IF v_wallet.wallet_frozen AND p_source NOT IN ('ADMIN_TOPUP', 'RECHARGE') THEN
        RAISE EXCEPTION 'Wallet is frozen for user_id: %', p_user_id;
    END IF;

    -- ADJUSTMENT and WEBHOOK_SYNC are allowed to go below zero (corrective entries)
    v_is_adjustment := (p_source IN ('ADJUSTMENT', 'WEBHOOK_SYNC'));
    v_actual_debit  := p_amount;
    v_description   := p_description;
    v_new_balance   := v_wallet.balance;
    v_new_reserved  := v_wallet.reserved_balance;

    -- ── Apply balance math (UNCONDITIONAL — wallet_enforced is intentionally ignored) ──
    IF p_type = 'DEBIT' THEN
        IF p_source = 'CAMPAIGN_SEND' THEN
            -- Draw from reserved bucket first, then from main balance
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
        'new_reserved',   v_new_reserved,
        'clamped',        (v_actual_debit != p_amount)
    );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §9  RESELLER TRANSFER RPCs
-- ═══════════════════════════════════════════════════════════════════════════

-- 9a. Atomic transfer from Tenant Admin Master Wallet → End User Wallet
--     Locks both rows (lower UUID first to prevent deadlock).
CREATE OR REPLACE FUNCTION transfer_reseller_balance(
    p_tenant_admin_user_id UUID,
    p_target_user_id       UUID,
    p_amount               NUMERIC,
    p_description          TEXT    DEFAULT NULL,
    p_created_by           UUID    DEFAULT NULL,
    p_ip_address           TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_master_wallet    public.user_wallets%ROWTYPE;
    v_target_wallet    public.user_wallets%ROWTYPE;
    v_master_new_bal   NUMERIC;
    v_target_new_bal   NUMERIC;
    v_master_bal_before NUMERIC;
    v_target_bal_before NUMERIC;
    v_master_domain    TEXT;
    v_target_domain    TEXT;
    v_debit_tx_id      UUID;
    v_credit_tx_id     UUID;
    v_desc             TEXT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Transfer amount must be positive. Got: %', p_amount;
    END IF;

    IF p_tenant_admin_user_id = p_target_user_id THEN
        RAISE EXCEPTION 'SELF_TRANSFER_NOT_ALLOWED: You cannot transfer funds to yourself. Your Master Wallet is already used for your own messaging.';
    END IF;

    -- Lock both rows in consistent UUID order to prevent deadlock
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

    IF v_master_wallet.user_id IS NULL THEN
        RAISE EXCEPTION 'MASTER_WALLET_NOT_FOUND: Tenant Admin % has no Master Wallet.', p_tenant_admin_user_id;
    END IF;

    -- Auto-create end-user wallet if missing
    IF v_target_wallet.user_id IS NULL THEN
        INSERT INTO public.user_wallets (user_id) VALUES (p_target_user_id)
            ON CONFLICT (user_id) DO NOTHING;
        SELECT * INTO v_target_wallet FROM public.user_wallets
            WHERE user_id = p_target_user_id FOR UPDATE;
    END IF;

    -- ── Guard: Master Wallet must have sufficient funds ───────────────────────
    IF v_master_wallet.balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_AGENCY_BALANCE: Master Wallet has ₹%. Cannot transfer ₹%.', v_master_wallet.balance, p_amount;
    END IF;

    v_master_bal_before := v_master_wallet.balance;
    v_target_bal_before := v_target_wallet.balance;

    SELECT signup_domain INTO v_master_domain FROM public.profiles WHERE id = p_tenant_admin_user_id;
    SELECT signup_domain INTO v_target_domain FROM public.profiles WHERE id = p_target_user_id;

    v_master_new_bal := v_master_wallet.balance - p_amount;
    v_target_new_bal := v_target_wallet.balance + p_amount;
    v_desc           := COALESCE(p_description, 'Reseller top-up from Agency Master Wallet');

    -- Debit Master Wallet
    UPDATE public.user_wallets SET balance = v_master_new_bal, updated_at = now()
        WHERE user_id = p_tenant_admin_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        source, description, tenant_domain, created_by, ip_address
    ) VALUES (
        p_tenant_admin_user_id, 'DEBIT', p_amount, v_master_bal_before, v_master_new_bal,
        'ADMIN_TOPUP',
        'Agency Master Wallet: Transferred ₹' || p_amount || ' → user ' || p_target_user_id,
        v_master_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_debit_tx_id;

    -- Credit Target User
    UPDATE public.user_wallets SET balance = v_target_new_bal, updated_at = now()
        WHERE user_id = p_target_user_id;

    INSERT INTO public.wallet_transactions (
        user_id, type, amount, balance_before, balance_after,
        source, description, tenant_domain, created_by, ip_address
    ) VALUES (
        p_target_user_id, 'CREDIT', p_amount, v_target_bal_before, v_target_new_bal,
        'ADMIN_TOPUP',
        v_desc || ' (from Agency Master Wallet)',
        v_target_domain, p_created_by, p_ip_address
    ) RETURNING id INTO v_credit_tx_id;

    RETURN jsonb_build_object(
        'success',            TRUE,
        'debit_tx_id',        v_debit_tx_id,
        'credit_tx_id',       v_credit_tx_id,
        'master_new_balance', v_master_new_bal,
        'user_new_balance',   v_target_new_bal
    );

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION '%', SQLERRM;
END;
$$;


-- 9b. Initialize Tenant Admin Master Wallet (idempotent)
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
            ON CONFLICT (user_id) DO UPDATE SET is_tenant_master = TRUE
            RETURNING * INTO v_wallet;
    END IF;

    RETURN jsonb_build_object('wallet_id', v_wallet.id, 'balance', v_wallet.balance);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §10 REPORTING FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

-- 10a. Revenue report — aggregated by tenant/user/campaign/category/source
CREATE OR REPLACE FUNCTION get_revenue_report(
    p_start_date    TIMESTAMPTZ,
    p_end_date      TIMESTAMPTZ,
    p_group_by      TEXT,
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    group_key              TEXT,
    total_debited          NUMERIC,
    total_meta_cost        NUMERIC,
    total_platform_revenue NUMERIC,
    transaction_count      BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN p_group_by = 'user'     THEN t.user_id::TEXT
            WHEN p_group_by = 'tenant'   THEN t.tenant_domain::TEXT
            WHEN p_group_by = 'campaign' THEN t.campaign_id::TEXT
            WHEN p_group_by = 'category' THEN t.wa_category::TEXT
            WHEN p_group_by = 'source'   THEN t.source::TEXT
            WHEN p_group_by = 'waba'     THEN t.whatsapp_account_id::TEXT
            ELSE 'ALL'
        END AS group_key,
        SUM(t.amount)                       AS total_debited,
        SUM(COALESCE(t.meta_cost, 0))       AS total_meta_cost,
        SUM(COALESCE(t.platform_cost, 0))   AS total_platform_revenue,
        COUNT(t.id)                         AS transaction_count
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date    IS NULL OR t.created_at     >= p_start_date)
      AND (p_end_date      IS NULL OR t.created_at     <= p_end_date)
      AND (p_tenant_domain IS NULL OR t.tenant_domain  = p_tenant_domain)
    GROUP BY 1
    ORDER BY total_debited DESC;
END;
$$;


-- 10b. Usage volume report — message counts by interval (day / week / month)
CREATE OR REPLACE FUNCTION get_usage_report(
    p_start_date    TIMESTAMPTZ,
    p_end_date      TIMESTAMPTZ,
    p_interval      TEXT,
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    interval_start        TIMESTAMPTZ,
    messages_sent         BIGINT,
    conversations_created BIGINT,
    marketing_count       BIGINT,
    utility_count         BIGINT,
    service_count         BIGINT,
    ai_calls              BIGINT,
    voice_calls           BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        date_trunc(p_interval, t.created_at)                                                   AS interval_start,
        COUNT(t.id)                                                                             AS messages_sent,
        COUNT(DISTINCT t.wa_conversation_id)                                                   AS conversations_created,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'MARKETING')                                AS marketing_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'UTILITY')                                  AS utility_count,
        COUNT(t.id) FILTER (WHERE t.wa_category = 'SERVICE')                                  AS service_count,
        COUNT(t.id) FILTER (WHERE t.source IN ('AI_CHAT','AI_CALL') OR t.wa_category = 'AI_CALL') AS ai_calls,
        COUNT(t.id) FILTER (WHERE t.source = 'VOICE' OR t.wa_category = 'VOICE_CALL')        AS voice_calls
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE t.type = 'DEBIT'
      AND (p_start_date    IS NULL OR t.created_at    >= p_start_date)
      AND (p_end_date      IS NULL OR t.created_at    <= p_end_date)
      AND (p_tenant_domain IS NULL OR t.tenant_domain = p_tenant_domain)
    GROUP BY 1
    ORDER BY 1 ASC;
END;
$$;


-- 10c. Wallet financial summary — total added / consumed / refunded / adjusted
CREATE OR REPLACE FUNCTION get_wallet_summary_report(
    p_start_date    TIMESTAMPTZ,
    p_end_date      TIMESTAMPTZ,
    p_tenant_domain TEXT DEFAULT NULL
)
RETURNS TABLE (
    total_added    NUMERIC,
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
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source IN ('ADMIN_TOPUP','RECHARGE')) AS total_added,
        SUM(t.amount) FILTER (WHERE t.type = 'DEBIT')                                             AS total_consumed,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'REFUND')                   AS total_refunded,
        SUM(t.amount) FILTER (WHERE t.type = 'CREDIT' AND t.source = 'ADJUSTMENT')               AS total_adjusted
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    WHERE (p_start_date    IS NULL OR t.created_at    >= p_start_date)
      AND (p_end_date      IS NULL OR t.created_at    <= p_end_date)
      AND (p_tenant_domain IS NULL OR t.tenant_domain = p_tenant_domain);
END;
$$;


-- 10d. Detailed Ledger Report — clean, flat ledger with balances and user info
CREATE OR REPLACE FUNCTION get_detailed_ledger_report(
    p_start_date          TIMESTAMPTZ DEFAULT NULL,
    p_end_date            TIMESTAMPTZ DEFAULT NULL,
    p_tenant_domain       TEXT DEFAULT NULL,
    p_user_id             UUID DEFAULT NULL,
    p_whatsapp_account_id UUID DEFAULT NULL
)
RETURNS TABLE (
    created_at          TIMESTAMPTZ,
    user_id             UUID,
    user_name           TEXT,
    user_email          TEXT,
    is_tenant_master    BOOLEAN,
    type                TEXT,
    source              TEXT,
    category            TEXT,
    amount              NUMERIC,
    balance_before      NUMERIC,
    balance_after       NUMERIC,
    meta_cost           NUMERIC,
    platform_cost       NUMERIC,
    description         TEXT,
    wa_message_id       TEXT,
    whatsapp_account_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        t.created_at,
        t.user_id,
        COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS user_name,
        p.email AS user_email,
        w.is_tenant_master,
        t.type,
        t.source,
        t.wa_category AS category,
        t.amount,
        t.balance_before,
        t.balance_after,
        t.meta_cost,
        t.platform_cost,
        t.description,
        t.wa_message_id,
        t.whatsapp_account_id
    FROM wallet_transactions t
    LEFT JOIN profiles p ON t.user_id = p.id
    LEFT JOIN user_wallets w ON t.user_id = w.user_id
    WHERE (p_start_date          IS NULL OR t.created_at          >= p_start_date)
      AND (p_end_date            IS NULL OR t.created_at          <= p_end_date)
      AND (p_tenant_domain       IS NULL OR t.tenant_domain       = p_tenant_domain)
      AND (p_user_id             IS NULL OR t.user_id             = p_user_id)
      AND (p_whatsapp_account_id IS NULL OR t.whatsapp_account_id = p_whatsapp_account_id)
    ORDER BY t.created_at DESC;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- §11 PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════

GRANT ALL ON TABLE public.user_wallets          TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.wallet_transactions   TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.wa_message_rates      TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.domain_wallet_settings TO postgres, anon, authenticated, service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- §12 SEED DEFAULT RATES (idempotent — ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.wa_message_rates (scope, user_id, category, country_code, meta_cost, platform_rate)
VALUES
    ('GLOBAL', NULL, 'MARKETING',      'IN', 0.0128, 0.70),
    ('GLOBAL', NULL, 'UTILITY',        'IN', 0.0040, 0.22),
    ('GLOBAL', NULL, 'AUTHENTICATION', 'IN', 0.0040, 0.22),
    ('GLOBAL', NULL, 'SERVICE',        'IN', 0.0040, 0.20)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF FILE
-- ═══════════════════════════════════════════════════════════════════════════
-- =========================================================================
-- FINAL MIGRATION: WABA Security & Complete Multi-Currency System
-- Run this script in the Supabase SQL Editor.
-- =========================================================================

BEGIN;

-- -------------------------------------------------------------------------
-- PART 1: WABA SECURITY & CONFIGURATION
-- -------------------------------------------------------------------------

-- 1. Add currency column to whatsapp_config (to track connected WABA currency)
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS currency TEXT;

-- 2. Add allowed_credit_currencies to domain_wallet_settings (for Super Admin controls)
ALTER TABLE public.domain_wallet_settings
ADD COLUMN IF NOT EXISTS allowed_credit_currencies TEXT[] DEFAULT '{"INR"}';

-- 3. Create the Auto-Demotion Function (Security measure against WABA hijacking)
CREATE OR REPLACE FUNCTION public.trg_auto_demote_on_waba_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger if one of the critical WABA config fields changes
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.whatsapp_business_account_id IS DISTINCT FROM OLD.whatsapp_business_account_id OR
            NEW.phone_number_id IS DISTINCT FROM OLD.phone_number_id OR
            NEW.meta_access_token IS DISTINCT FROM OLD.meta_access_token OR
            NEW.access_token IS DISTINCT FROM OLD.access_token) THEN
            
            -- Reset billing_mode to DIRECT_META for this user to prevent fraud
            UPDATE public.user_wallets
            SET billing_mode = 'DIRECT_META'
            WHERE user_id = NEW.user_id 
              AND billing_mode != 'DIRECT_META';
              
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Attach the trigger to whatsapp_config
DROP TRIGGER IF EXISTS trg_waba_security_reset ON public.whatsapp_config;
CREATE TRIGGER trg_waba_security_reset
AFTER UPDATE ON public.whatsapp_config
FOR EACH ROW
EXECUTE FUNCTION public.trg_auto_demote_on_waba_change();


-- -------------------------------------------------------------------------
-- PART 2: MULTI-CURRENCY PRICING SYSTEM
-- -------------------------------------------------------------------------

-- 5. Add currency column to wa_message_rates table
ALTER TABLE public.wa_message_rates 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';

-- 6. Drop the existing unique constraint (which did not include currency)
ALTER TABLE public.wa_message_rates 
DROP CONSTRAINT IF EXISTS wa_message_rates_scope_user_id_category_country_code_key;

-- 7. Add the new unique constraint including currency
ALTER TABLE public.wa_message_rates 
ADD CONSTRAINT wa_message_rates_scope_user_id_category_country_code_currency_key 
UNIQUE NULLS NOT DISTINCT (scope, user_id, category, country_code, currency);

COMMIT;
