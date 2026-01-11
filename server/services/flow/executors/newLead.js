const { supabase, supabaseAdmin } = require('../../../lib/supabaseClient');

const execute = async (session, node, context) => {
    try {
        const phone = session.contact_phone;
        const userId = session.user_id;

        console.log(`[NewLeadExecutor] Checking if ${phone} is a new lead for user ${userId}`);

        if (!phone) {
            console.warn('[NewLeadExecutor] No phone number in session. Defaulting to New Lead.');
            return { status: 'success', outcome: 'new', timestamp: new Date().toISOString() };
        }

        const rpcClient = supabaseAdmin || supabase;

        // normalization: strip all non-digits
        const cleanPhone = phone.replace(/\D/g, '');
        const phoneWithPlus = `+${cleanPhone}`;

        // Construct filter: Check exact match, cleaned match, and +cleaned match.
        // We use OR syntax: phone.eq.X,phone.eq.Y,phone.eq.Z
        const filter = `phone.eq.${phone},phone.eq.${cleanPhone},phone.eq.${phoneWithPlus}`;

        console.log(`[NewLeadExecutor] Query Filter: ${filter}`);

        // Fetch data instead of just count to check timestamps
        const { data: contacts, error } = await rpcClient
            .from('contacts')
            .select('created_at')
            .eq('user_id', userId)
            .or(filter)
            .order('created_at', { ascending: false })
            .limit(1);

        if (error) {
            console.error('[NewLeadExecutor] Error checking existing contacts:', error);
            throw error;
        }

        let isNewLead = true;

        if (contacts && contacts.length > 0) {
            const contact = contacts[0];
            const createdAt = new Date(contact.created_at).getTime();
            const now = Date.now();
            const diff = now - createdAt;

            // RACE CONDITION FIX:
            // The webhook creates the contact BEFORE invoking the flow.
            // If the contact was created very recently (e.g., < 10 seconds ago), we treat it as "New".
            if (diff < 10000) { // 10 seconds threshold
                console.log(`[NewLeadExecutor] Contact found but created recently (${diff}ms ago). Treating as NEW Lead.`);
                isNewLead = true;
            } else {
                console.log(`[NewLeadExecutor] Contact found and is old (${diff}ms ago). Treating as EXISTING.`);
                isNewLead = false;
            }
        } else {
            console.log('[NewLeadExecutor] No contact found (Count: 0). Result: New Lead');
            isNewLead = true;
        }

        return {
            status: 'success',
            outcome: isNewLead ? 'new' : 'existing',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[NewLeadExecutor] Execution failed:', error);
        return { success: false, error: error.message };
    }
};

module.exports = { execute };
