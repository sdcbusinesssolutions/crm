
SELECT id, name, status, nodes 
FROM flows 
WHERE nodes::text LIKE '%taskReminder%' 
AND status = 'published';
