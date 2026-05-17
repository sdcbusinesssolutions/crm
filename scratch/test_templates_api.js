module.paths.push('/home/devendra/proj/wpcode/server/node_modules');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const path = require('path');

// Load environment variables
try {
    require('dotenv').config({ path: path.join(__dirname, '../server/.env') });
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

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

    console.log('Fetching permissions for staff...');
    const { data: perms, error: permError } = await supabaseAdmin
      .from('team_staff_permissions')
      .select('module_name, access_type')
      .eq('staff_id', staff.id);

    const permissions = (perms || []).reduce((acc, p) => {
      acc[p.module_name] = p.access_type;
      return acc;
    }, {});

    const secret = (process.env.JWT_SECRET || 'your-secret-key').trim();
    console.log('Signing token with JWT_SECRET length:', secret.length);

    const token = jwt.sign(
      {
        staffId: staff.id,
        tenantId: staff.tenant_id,
        email: staff.email,
        role: 'staff',
        permissions
      },
      secret,
      { expiresIn: '24h' }
    );

    console.log('Sending request to /api/whatsapp/templates...');
    try {
        const res = await axios.get('http://localhost:5000/api/whatsapp/templates', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log('STATUS:', res.status);
        console.log('DATA:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('API Request failed:', err.response ? {
            status: err.response.status,
            data: err.response.data
        } : err.message);
    }
}

run();
