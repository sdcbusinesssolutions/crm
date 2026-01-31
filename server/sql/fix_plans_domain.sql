ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'clickube.com';

-- Update existing NULLs which might have been created if the column existed but was empty (unlikely given the error, but safe)
UPDATE public.plans SET domain = 'clickube.com' WHERE domain IS NULL;

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload config';
