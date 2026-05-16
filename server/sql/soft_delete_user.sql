-- =================================================================
-- SOFT DELETE MULTIPLE USERS: Ban permanently + Mark as deleted
-- =================================================================
-- ✅ Add/remove emails in the list on lines 8-12. Run all together.
-- =================================================================

-- 🎯 ADD YOUR EMAILS HERE (comma-separated, one per line):
SET app.delete_emails = 'user1@example.com,user2@example.com,user3@example.com';

-- 1. Ban the users permanently (blocks all logins forever)
UPDATE auth.users
SET banned_until = '2999-12-31T23:59:59Z',
    updated_at = NOW()
WHERE email = ANY(string_to_array(current_setting('app.delete_emails'), ','));

-- 2. Mark profiles as deleted (hides from user lists)
UPDATE profiles
SET signup_domain = 'deleted',
    plan_status = 'banned',
    updated_at = NOW()
WHERE email = ANY(string_to_array(current_setting('app.delete_emails'), ','));

-- ✅ Verify:
SELECT id, email, banned_until FROM auth.users
WHERE email = ANY(string_to_array(current_setting('app.delete_emails'), ','));

SELECT id, email, signup_domain, plan_status FROM profiles
WHERE email = ANY(string_to_array(current_setting('app.delete_emails'), ','));
