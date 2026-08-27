-- 1. Drip Campaigns टेबल का फिक्स
ALTER TABLE public.drip_campaigns DROP CONSTRAINT "drip_campaigns_user_id_fkey";
ALTER TABLE public.drip_campaigns 
  ADD CONSTRAINT "drip_campaigns_user_id_fkey" 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Follow Ups टेबल का फिक्स
ALTER TABLE public.follow_ups DROP CONSTRAINT "follow_ups_user_id_fkey";
ALTER TABLE public.follow_ups 
  ADD CONSTRAINT "follow_ups_user_id_fkey" 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. WhatsApp Flow Submissions टेबल का फिक्स
ALTER TABLE public.whatsapp_flow_submissions DROP CONSTRAINT "whatsapp_flow_submissions_user_id_fkey";
ALTER TABLE public.whatsapp_flow_submissions 
  ADD CONSTRAINT "whatsapp_flow_submissions_user_id_fkey" 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
