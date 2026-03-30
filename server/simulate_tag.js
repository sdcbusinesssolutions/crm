const { supabaseAdmin } = require('./lib/supabaseClient');
const DripTriggerService = require('./services/DripTriggerService');

async function simulate() {
    const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
    // We need a contact that belongs to this user.
    console.log('--- Fetching a contact for user ---');
    const { data: contacts, error: cErr } = await supabaseAdmin
        .from('contacts')
        .select('*')
        .eq('user_id', userId)
        .limit(1);
    
    if (cErr || !contacts || contacts.length === 0) {
        console.error('Error fetching contact or no contact found for user', cErr);
        return;
    }
    const contact = contacts[0];
    console.log(`Found contact: ${contact.id} (Phone: ${contact.phone})`);

    const addedTags = ['abc'];
    console.log(`--- Simulating handleTagAdded for user ${userId} and contact ${contact.id} with tags: ${addedTags.join(', ')} ---`);

    try {
        await DripTriggerService.handleTagAdded(userId, contact, addedTags);
        console.log('--- simulation call finished ---');
    } catch (err) {
        console.error('Simulation failed with error:', err);
    }
}

simulate();
