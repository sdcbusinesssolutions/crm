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
