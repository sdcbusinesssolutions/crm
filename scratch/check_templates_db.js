const { supabaseAdmin } = require('../server/lib/supabaseClient');

async function run() {
    console.log('Querying team_staff for user3@gmail.com...');
    const { data: staff, error: staffErr } = await supabaseAdmin
        .from('team_staff')
        .select('*')
        .eq('email', 'user3@gmail.com')
        .single();
    
    if (staffErr) {
        console.error('Error fetching staff:', staffErr);
        return;
    }
    console.log('Staff info:', staff);

    const tenantId = staff.tenant_id;
    console.log(`Querying whatsapp_templates for tenant_id: ${tenantId}...`);
    const { data: templates, error: templatesErr } = await supabaseAdmin
        .from('whatsapp_templates')
        .select('id, name, user_id, last_synced_at')
        .eq('user_id', tenantId);

    if (templatesErr) {
        console.error('Error fetching templates:', templatesErr);
        return;
    }
    console.log(`Templates count for tenant ${tenantId}:`, templates.length);
    console.log('Templates list:', templates);
}

run();
