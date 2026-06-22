-- =============================================================================
-- Migration 224: Finalize Wallet Source Constraint
-- Adds AGENCY_MARKUP to the allowed source list (used for Tenant Admin SaaS markup fee collection).
-- Run this in Supabase SQL Editor after 223_audit_compliance.sql
-- =============================================================================

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
        'RESERVATION_RELEASE',
        'AGENCY_MARKUP'    -- Tenant Admin SaaS markup fee deducted from Master Wallet
    ));
