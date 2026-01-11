const { supabase } = require('./lib/supabaseClient');

const checkConnection = async () => {
    console.log('Testing Supabase Connection...');
    const start = Date.now();
    try {
        const { data, error } = await supabase.from('whatsapp_config').select('count', { count: 'exact', head: true }).limit(1);

        const duration = Date.now() - start;
        if (error) {
            console.error('❌ Supabase Error:', error.message);
            console.error('Details:', error);
        } else {
            console.log(`✅ Supabase Connection Successful! (Took ${duration}ms)`);
        }
    } catch (e) {
        console.error('❌ Connection Failed:', e.message);
        if (e.cause) console.error('Cause:', e.cause);
    }
};

checkConnection();
