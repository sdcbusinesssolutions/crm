-- Create Pipelines Table
CREATE TABLE IF NOT EXISTS crm_pipelines (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Stages Table
CREATE TABLE IF NOT EXISTS crm_stages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pipeline_id UUID REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add stage_id to contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES crm_stages(id) ON DELETE SET NULL;

-- Initial Seed Function
CREATE OR REPLACE FUNCTION seed_default_pipeline(target_user_id UUID) 
RETURNS VOID AS $$
DECLARE
    new_pipeline_id UUID;
BEGIN
    -- Check if user already has pipelines
    IF NOT EXISTS (SELECT 1 FROM crm_pipelines WHERE user_id = target_user_id) THEN
        -- Create Default Pipeline
        INSERT INTO crm_pipelines (user_id, name) 
        VALUES (target_user_id, 'Default Pipeline') 
        RETURNING id INTO new_pipeline_id;

        -- Create Default Stages
        INSERT INTO crm_stages (pipeline_id, name, order_index) VALUES 
        (new_pipeline_id, 'New', 0),
        (new_pipeline_id, 'Contacted', 1),
        (new_pipeline_id, 'Qualified', 2),
        (new_pipeline_id, 'Converted', 3),
        (new_pipeline_id, 'Lost', 4);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Backfill Function to map existing string statuses to the new stages
CREATE OR REPLACE FUNCTION backfill_contact_stages(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
    def_pipeline_id UUID;
    stage_rec RECORD;
BEGIN
    -- Ensure seed exists
    PERFORM seed_default_pipeline(target_user_id);

    -- Get Default Pipeline ID
    SELECT id INTO def_pipeline_id FROM crm_pipelines WHERE user_id = target_user_id LIMIT 1;

    -- Update contacts based on their string status
    FOR stage_rec IN SELECT id, name FROM crm_stages WHERE pipeline_id = def_pipeline_id
    LOOP
        UPDATE contacts 
        SET stage_id = stage_rec.id
        WHERE user_id = target_user_id 
        AND status = stage_rec.name 
        AND stage_id IS NULL;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
