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
