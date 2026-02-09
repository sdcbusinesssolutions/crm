-- Add updated_at column to drip_campaigns
ALTER TABLE public.drip_campaigns 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for drip_campaigns
DROP TRIGGER IF EXISTS update_drip_campaigns_updated_at ON public.drip_campaigns;
CREATE TRIGGER update_drip_campaigns_updated_at
    BEFORE UPDATE ON public.drip_campaigns
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
