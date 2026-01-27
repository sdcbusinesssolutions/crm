
require('dotenv').config({ path: '../.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function recover() {
    console.log('--- Recovering Missing Leads ---');

    // 1. Get Form "jkl" OR "ty" (user screenshot mentioned "ty", but showed "jkl" later? I'll fetch ALL forms by name if needed, or just iterate submission)
    // Assuming "jkl"
    const { data: form } = await supabase.from('forms').select('*').eq('name', 'jkl').single();
    if (!form) { console.log('Form jkl not found'); return; }

    // 2. Get Submissions
    const { data: submissions } = await supabase.from('form_submissions').select('*').eq('form_id', form.id);
    console.log(`Found ${submissions.length} submissions.`);

    for (const sub of submissions) {
        const data = sub.submission_data || sub.data;
        if (!data) continue;

        // Extract Info
        let name = data.name || data.full_name || data['First Name'] || 'Unknown';
        let email = null;
        let phone = null;
        Object.keys(data).forEach(k => {
            const key = k.toLowerCase();
            const val = data[k];
            if (!val) return;
            if (key.includes('email') || (typeof val === 'string' && val.includes('@'))) email = val;
            if (key.includes('phone') || key.includes('mobile')) phone = val;
            if (name === 'Unknown' && key.includes('name')) name = val;
        });

        if (!email && !phone) {
            console.log('Skipping: No contact info');
            continue;
        }

        // Check/Create Lead WITHOUT CONTACT_ID
        if (form.pipeline_id) {
            let leadQuery = supabase.from('leads').select('id').eq('pipeline_id', form.pipeline_id);
            if (email) leadQuery = leadQuery.eq('email', email);
            else if (phone) leadQuery = leadQuery.eq('phone', phone);

            const { data: existingLeads } = await leadQuery;

            if (!existingLeads || existingLeads.length === 0) {
                console.log(`Creating Lead for ${name}...`);
                const { error: lErr } = await supabase.from('leads').insert([{
                    user_id: form.user_id,
                    // contact_id: contactId, // REMOVED
                    pipeline_id: form.pipeline_id,
                    stage_id: form.stage_id,
                    name: name,
                    email: email,
                    phone: phone,
                    source: 'Recovered from Form',
                    status: 'active',
                    estimated_value: 0
                }]);
                if (lErr) console.log('Lead Insert Error:', lErr.message);
                else console.log('Lead Created Successfully.');
            } else {
                console.log(`Lead for ${name} already exists.`);
            }
        }
    }
}

recover();
