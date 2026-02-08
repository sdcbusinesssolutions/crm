SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

SELECT * FROM leads WHERE phone = '919373393645';

-- Check if there's a contacts table
SELECT * FROM information_schema.columns WHERE table_name = 'contacts' OR table_name = 'whatsapp_contacts';

-- Check the 'tasks' table columns again
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'tasks';
