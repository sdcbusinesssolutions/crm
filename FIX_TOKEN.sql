-- Fix Verify Token Mismatch
-- Run this in Supabase SQL Editor to ensure the token matches your test script.

UPDATE public.whatsapp_config
SET verify_token = 'test-test'
WHERE user_id = '5ae5999e-1eb2-4425-adf4-858156709d2d';
