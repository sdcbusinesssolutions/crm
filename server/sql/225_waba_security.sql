-- MIGRATION: WABA Security & Currency Validation
-- Adds currency tracking to whatsapp_config and auto-reset triggers for security.

BEGIN;

-- 1. Add currency column to whatsapp_config
ALTER TABLE public.whatsapp_config 
ADD COLUMN IF NOT EXISTS currency TEXT;

-- 2. Add allowed_credit_currencies to domain_wallet_settings
ALTER TABLE public.domain_wallet_settings
ADD COLUMN IF NOT EXISTS allowed_credit_currencies TEXT[] DEFAULT '{"INR"}';

-- 3. Create the Auto-Demotion Function
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

COMMIT;
