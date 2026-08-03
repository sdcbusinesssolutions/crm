-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 220: 3-Tier Hybrid Billing Modes
-- Run this in the Supabase SQL Editor AFTER wallet_migration.sql
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Add billing_mode to user_wallets
--    CREDIT_LINE_SUPER  → User uses Super Admin's credit line (Reseller Model).
--                         Tenant Admin must have sufficient Master Wallet to top up.
--    CREDIT_LINE_TENANT → User uses Tenant Admin's own credit line (Agency Model).
--                         Tenant Admin can top up unlimited (they own the liability).
--    DIRECT_META        → User pays Meta directly with their own card.
--                         Wallet only charges platform markup, NOT Meta cost.
ALTER TABLE public.user_wallets
    ADD COLUMN IF NOT EXISTS billing_mode TEXT
        NOT NULL DEFAULT 'DIRECT_META'
        CHECK (billing_mode IN ('CREDIT_LINE_SUPER', 'CREDIT_LINE_TENANT', 'DIRECT_META'));

-- 2. Add is_tenant_master flag — identifies Tenant Admin's own Master Wallet row
ALTER TABLE public.user_wallets
    ADD COLUMN IF NOT EXISTS is_tenant_master BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast Master Wallet lookups
CREATE INDEX IF NOT EXISTS idx_user_wallets_tenant_master
    ON public.user_wallets(is_tenant_master)
    WHERE is_tenant_master = TRUE;

-- 3. Domain-level default billing mode
--    Super Admin sets the default billing mode for all new users on a domain.
CREATE TABLE IF NOT EXISTS public.domain_wallet_settings (
    id              UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    domain          TEXT NOT NULL UNIQUE,
    -- Default billing mode applied to new users created under this domain
    default_billing_mode TEXT NOT NULL DEFAULT 'DIRECT_META'
        CHECK (default_billing_mode IN ('CREDIT_LINE_SUPER', 'CREDIT_LINE_TENANT', 'DIRECT_META')),
    -- Tenant Admin User ID who owns this domain (set by Super Admin)
    tenant_admin_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    -- Whether the Tenant Admin is allowed to change user billing modes
    allow_tenant_billing_control BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domain_wallet_settings_domain
    ON public.domain_wallet_settings(domain);
