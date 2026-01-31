# Fix "Could not find 'domain' column" Error

The error occurs because the `plans` table in your Database is missing the `domain` column, which is required for the new multi-tenancy features.

Since I cannot automatically execute SQL command directly against your Supabase database (due to missing connection string credentials), you need to run the following SQL script manually.

## Instructions

1.  **Open Supabase Dashboard**: Go to your project dashboard at [supabase.com](https://supabase.com).
2.  **Go to SQL Editor**: Click on the SQL Editor icon in the sidebar (or hit `s` then `e` if you have shortcuts).
3.  **New Query**: Click "New query".
4.  **Copy & Paste**: Copy the code block below and paste it into the editor.
5.  **Run**: Click "Run".

```sql
-- 1. Add 'domain' column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'plans' AND column_name = 'domain') THEN
        ALTER TABLE public.plans ADD COLUMN domain text DEFAULT 'clickube.com';
    END IF;
END $$;

-- 2. Update any existing plans that might have NULL domain
UPDATE public.plans SET domain = 'clickube.com' WHERE domain IS NULL;

-- 3. Create an index for performance
CREATE INDEX IF NOT EXISTS idx_plans_domain ON public.plans(domain);

-- 4. Notify PostgREST to reload the schema cache (Fixes "schema cache" errors)
NOTIFY pgrst, 'reload config';
```

After running this, the error should disappear and you can create/assign plans.
