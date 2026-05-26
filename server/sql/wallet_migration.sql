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
