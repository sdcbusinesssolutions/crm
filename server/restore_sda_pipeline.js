
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function restoreSdaPipeline() {
    console.log('--- RESTORE SDA PIPELINE ---');

    // 1. Resolve Users
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const u1 = users.find(u => u.email === 'kd31967@gmail.com'); // Target
    const u3 = users.find(u => u.email === 'user1.compnet@gmail.com'); // Source

    if (!u1 || !u3) { console.log('Users not found'); return; }

    // 2. Find Pipeline named "sda" (case insensitive)
    // Pipelines might be in 'leads' table (pipeline_id) linked to a 'pipelines' table?
    // Let's check if there is a 'pipelines' table.

    // First, list pipelines owned by U3 to find "sda"
    const { data: pipelines, error: pError } = await supabase
        .from('pipelines')
        .select('id, name')
        .eq('user_id', u3.id)
        .ilike('name', '%sda%'); // Fuzzy match

    if (pError) {
        // Table might not exist or be named differently? 
        console.log('Error checking pipelines table (maybe it does not exist?):', pError.message);
        // If pipelines table doesn't exist, maybe pipeline names are distinct in leads? 
        // But usually there is a pipelines table.
    } else if (pipelines.length > 0) {
        console.log(`Found ${pipelines.length} pipelines matching 'sda' owned by User 3:`);
        pipelines.forEach(p => console.log(`- ${p.name} [${p.id}]`));

        const pipelineIds = pipelines.map(p => p.id);

        // Move the Pipeline itself to User 1
        console.log('Moving pipeline(s) to User 1...');
        await supabase.from('pipelines').update({ user_id: u1.id }).in('id', pipelineIds);

        // Move Leads in these pipelines
        console.log('Moving leads in these pipelines...');
        const { data: leads, error: lError } = await supabase
            .from('leads')
            .update({ user_id: u1.id })
            .in('pipeline_id', pipelineIds)
            .select();

        if (lError) console.error('Error moving leads:', lError);
        else console.log(`Moved ${leads.length} leads.`);

    } else {
        console.log('No "sda" pipeline found owned by User 3.');

        // Maybe it's already owned by U1 but empty?
        const { data: p1 } = await supabase
            .from('pipelines')
            .select('id, name')
            .eq('user_id', u1.id)
            .ilike('name', '%sda%');

        if (p1 && p1.length > 0) {
            console.log('User 1 ALREADY owns "sda" pipeline.');
            const pid = p1[0].id;

            // Check for STRANDED leads (Leads in this pipeline but owned by U3)
            const { count } = await supabase
                .from('leads')
                .select('*', { count: 'exact', head: true })
                .eq('pipeline_id', pid)
                .eq('user_id', u3.id);

            console.log(`Found ${count} stranded leads (Owned by U3, but in U1's pipeline).`);

            if (count > 0) {
                console.log(' rescuing stranded leads...');
                await supabase
                    .from('leads')
                    .update({ user_id: u1.id })
                    .eq('pipeline_id', pid)
                    .eq('user_id', u3.id);
                console.log('Leads rescued.');
            }
        }
    }
}

restoreSdaPipeline();
