const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const verifyPassword = (password, storedHash) => {
  const [salt, hash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
};

async function testStaffLogin(email, password) {
    console.log(`Testing login for ${email}...`);
    const { data: staff, error } = await supabaseAdmin
      .from('team_staff')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !staff) {
        console.error('❌ Staff not found:', error?.message || 'No record');
        return;
    }

    console.log('✅ Staff record found. Hashed password:', staff.password_hash);
    
    const isMatch = verifyPassword(password, staff.password_hash);
    if (isMatch) {
        console.log('🎉 SUCCESS: Password matches!');
    } else {
        console.log('❌ FAILURE: Password does NOT match.');
    }
}

const args = process.argv.slice(2);
testStaffLogin(args[0] || 'user2@gmail.com', args[1] || 'user2');
