-- ==========================================
-- 1. Clean Contacts (Primary Source)
-- ==========================================
UPDATE contacts
SET phone = REPLACE(phone, '+', '')
WHERE phone LIKE '+%';

-- ==========================================
-- 2. Clean Conversations
-- ==========================================
UPDATE conversations
SET contact_phone = REPLACE(contact_phone, '+', '')
WHERE contact_phone LIKE '+%';

-- ==========================================
-- 3. Clean Messages
-- ==========================================
-- Clean contact_phone field in messages
UPDATE messages
SET contact_phone = REPLACE(contact_phone, '+', '')
WHERE contact_phone LIKE '+%';

-- ==========================================
-- 4. Clean Whatsapp Flow Submissions
-- ==========================================
UPDATE whatsapp_flow_submissions
SET contact_phone = REPLACE(contact_phone, '+', '')
WHERE contact_phone LIKE '+%';

-- ==========================================
-- 5. Clean Campaign Queue (Recipients)
-- ==========================================
UPDATE campaign_queue
SET phone_number = REPLACE(phone_number, '+', '')
WHERE phone_number LIKE '+%';

-- ==========================================
-- 6. Clean User Accounts (If used as phone numbers)
-- ==========================================
-- (Optional, modify if you use phone for login)
-- UPDATE auth.users SET phone = REPLACE(phone, '+', '') WHERE phone LIKE '+%';
