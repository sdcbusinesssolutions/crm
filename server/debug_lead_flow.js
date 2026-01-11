const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

const check = async () => {
    try {
        const rpcClient = supabaseAdmin || supabase;
        const targetPhone = '917000698637';

        console.log(`\n--- Checking Status for ${targetPhone} ---`);

        // 1. Check Contact
        const { data: contacts, count } = await rpcClient
            .from('contacts')
            .select('*', { count: 'exact' })
            .ilike('phone', `%${targetPhone.slice(-10)}%`); // Loose check

        console.log(`Found ${count} matching contacts.`);
        contacts.forEach(c => console.log(`- Contact: ${c.name}, ${c.phone} (ID: ${c.id})`));

        // 2. Check Recent Sessions
        const { data: sessions } = await rpcClient
            .from('flow_sessions')
            .select('*')
            .ilike('contact_phone', `%${targetPhone.slice(-10)}%`)
            .order('last_interaction_at', { ascending: false })
            .limit(3);

        console.log(`\nFound ${sessions.length} sessions.`);
        sessions.forEach(s => {
            console.log(`- Session: ${s.id}, Node: ${s.current_node_id}, Status: ${s.status}, Updated: ${s.last_interaction_at}`);
        });

    } catch (e) {
        console.error(e);
    }
};

check();
