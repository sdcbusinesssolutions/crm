-- MIGRATION: Multi-Currency Support for Rates
-- Updates the unique constraint on wa_message_rates to include the currency column.

BEGIN;

-- 1. Drop the existing unique constraint
-- The constraint is usually named something like wa_message_rates_scope_user_id_category_country_code_key
-- If you used a different name, you'll need to find it using:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.wa_message_rates'::regclass AND contype = 'u';

ALTER TABLE public.wa_message_rates 
DROP CONSTRAINT IF EXISTS wa_message_rates_scope_user_id_category_country_code_key;

-- 2. Add the new unique constraint including currency
ALTER TABLE public.wa_message_rates 
ADD CONSTRAINT wa_message_rates_scope_user_id_category_country_code_currency_key 
UNIQUE NULLS NOT DISTINCT (scope, user_id, category, country_code, currency);

COMMIT;
