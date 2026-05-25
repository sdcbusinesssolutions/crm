-- Ensure assigned_staff_ids column exists on leads table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'assigned_staff_ids') THEN
        ALTER TABLE leads ADD COLUMN assigned_staff_ids UUID[] DEFAULT '{}';
    END IF;
END $$;
