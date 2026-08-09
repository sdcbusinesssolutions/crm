const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_MASTER_KEY || process.env.SUPABASE_SERVICE_KEY);
supabase.from('messages').select('type, status, text, whatsapp_message_id, created_at').order('created_at', { ascending: false }).limit(10).then(res => { console.log(JSON.stringify(res.data, null, 2)); process.exit(0); });
