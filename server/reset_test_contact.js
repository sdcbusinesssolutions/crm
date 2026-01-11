const { supabaseAdmin } = require('./lib/supabaseClient');

const resetTestContact = async () => {
    const phoneNumber = '917000698637';
    try {
        console.log(`Deleting contact with phone: ${phoneNumber}...`);

        // Use normalized check (+ and without +)
        const { data, error } = await supabaseAdmin
            .from('contacts')
            .delete()
            .or(`phone.eq.${phoneNumber},phone.eq.+${phoneNumber}`)
            .select();

        if (error) {
            console.error('Error deleting contact:', error);
        } else {
            console.log(`Deleted ${data.length} contact(s).`);
        }
    } catch (e) {
        console.error(e);
    }
};

resetTestContact();
