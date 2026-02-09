-- 1. Fix follow_ups table (missing updated_at)
ALTER TABLE public.follow_ups 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_follow_ups_updated_at ON public.follow_ups;
CREATE TRIGGER update_follow_ups_updated_at
    BEFORE UPDATE ON public.follow_ups
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 2. Fix drip_campaigns table (if not already fixed)
ALTER TABLE public.drip_campaigns 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

DROP TRIGGER IF EXISTS update_drip_campaigns_updated_at ON public.drip_campaigns;
CREATE TRIGGER update_drip_campaigns_updated_at
    BEFORE UPDATE ON public.drip_campaigns
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Refresh the schema cache
NOTIFY pgrst, 'reload schema';
