-- Run this in your Supabase SQL Editor
ALTER TABLE custom_menus 
ADD COLUMN IF NOT EXISTS domain TEXT,
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- Optional: Create an index for faster lookup since we will query by domain
CREATE INDEX IF NOT EXISTS idx_custom_menus_domain ON custom_menus(domain);

-- Create composite and specific indexes for fastest possible lookups on the user side
CREATE INDEX IF NOT EXISTS idx_custom_menus_user_id ON custom_menus(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_menus_domain_global ON custom_menus(domain, is_global);
