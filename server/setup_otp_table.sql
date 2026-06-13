CREATE TABLE IF NOT EXISTS public.password_reset_otps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL,
    domain TEXT NOT NULL,
    otp TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_otps_email_domain ON public.password_reset_otps(email, domain);
