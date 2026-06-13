require('dotenv').config({ path: '/home/devendra/proj/wpcode/server/.env' });
const { supabaseAdmin } = require('./lib/supabaseClient');

async function main() {
    try {
        const { data: match, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('provider', 'whatsapp')
            .contains('credentials', { phone_number_id: '712851515243145' })
            .limit(1);
            
        console.log('Match:', match);
        console.log('Error:', error);
    } catch(err) {
        console.log('Error:', err);
    } finally {
        process.exit(0);
    }
}
main();
