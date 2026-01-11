const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: 'server/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function testFetch() {
    const templateName = 'tempcarow';

    console.log(`Fetching template '${templateName}'`);

    const { data: localTmpls, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('name', templateName);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Found templates:', localTmpls.length);
        if (localTmpls.length > 0) {
            console.log('Columns:', Object.keys(localTmpls[0]));
            localTmpls.forEach(t => {
                console.log(`- Name: ${t.name}, Lang: ${t.language}, User: ${t.user_id}`);
                console.log(`  Components detected? ${!!t.components}`);
                console.log(`  Buttons detected? ${!!t.buttons}`);
                if (t.buttons) console.log('  Buttons Type:', t.buttons.type);
            });
        }
    }
}

testFetch();
