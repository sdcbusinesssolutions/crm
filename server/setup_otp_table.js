require('dotenv').config({ path: __dirname + '/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = `
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
`;

pool.query(query)
  .then(() => {
    console.log('Successfully created password_reset_otps table');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error creating table:', err);
    process.exit(1);
  });
