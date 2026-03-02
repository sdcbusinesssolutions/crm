const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ssckorsnhjhzqxyukexm.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNzY2tvcnNuaGpoenF4eXVrZXhtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODM5OTcwOSwiZXhwIjoyMDgzOTc1NzA5fQ.aNUZx09EwkA4tEmHRK-LL4l-J6ySioqTY3c9PcQCJHc';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

async function checkWaterMessage() {
    const messageId = "wamid.HBgMOTE4NDA4OTA3NTE2FQIAEhggQUNDRThEN0IzNERBQzIxQzM0QkU4OEFDRjA3Njg1MzgA";
    console.log(`Checking database for message exact match: ${messageId}`);

    const { data: messages } = await supabaseAdmin.from('messages').select('*').eq('whatsapp_message_id', messageId);

    if (messages && messages.length > 0) {
        console.log("FOUND IN MESSAGES TABLE!");
        messages.forEach(m => {
            console.log(`Created: ${m.created_at} | Direction: ${m.direction} | Text: ${m.text}`);
        });
    } else {
        console.log("NOT found in messages table. Why?");
    }
}

checkWaterMessage();
