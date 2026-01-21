
-- Check whatsapp_config for the system number
SELECT user_id, phone_number, phone_number_id 
FROM whatsapp_config 
WHERE phone_number LIKE '%917559410321%';

-- Check conversations for the contact number
SELECT id, user_id, contact_phone 
FROM conversations 
WHERE contact_phone LIKE '%917857836481%';
