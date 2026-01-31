
-- Sync profiles with active subscriptions
UPDATE profiles
SET 
  plan_name = p.name,
  plan_status = s.status,
  plan_expires_at = s.end_date
FROM user_subscriptions s
JOIN plans p ON s.plan_id = p.id
WHERE 
  profiles.id = s.user_id
  AND s.status = 'active';
