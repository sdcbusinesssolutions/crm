const { supabaseAdmin } = require('../../../lib/supabaseClient');
const contextManager = require('../context');
module.exports = {
    async execute(session, node, context) {
        try {
            let formId = node.data.formId;
            let contactPhone = session.contact_phone || session.phone;
        
        // If manual contact phone is provided, it overrides the default
        if (node.data.manualContactPhone) {
            contactPhone = contextManager.resolve(node.data.manualContactPhone, context);
        }
        
        // If manual form ID is provided, it overrides the dropdown selection
        if (node.data.manualFormId) {
            // Resolve variables if any (e.g. {{contact.form_id}})
            formId = contextManager.resolve(node.data.manualFormId, context);
        }

        if (!formId) {
            throw new Error('CheckForm: No formId configured or resolved');
        }

        if (!contactPhone) {
            console.warn('CheckForm: No contactPhone available, assuming form not submitted.');
            return { status: 'success', outcome: 'false' };
        }

        // Extract last 10 digits to avoid country code mismatches (e.g. 91 vs no 91)
        const cleanPhone = contactPhone.replace(/\D/g, '');
        const searchPhone = cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone;

        // Fetch recent submissions for this form and search inside the JSON data
        const { data, error } = await supabaseAdmin
            .from('form_submissions')
            .select('submission_data')
            .eq('form_id', formId)
            .order('submitted_at', { ascending: false })
            .limit(500);

        if (error) {
            throw new Error(`Database error checking form submission: ${error.message}`);
        }

        let hasSubmitted = false;
        if (data && data.length > 0) {
            for (const sub of data) {
                const subStr = JSON.stringify(sub.submission_data || {});
                if (subStr.includes(searchPhone)) {
                    hasSubmitted = true;
                    break;
                }
            }
        }

        // How does checkCondition return the next node? Let's check.
        // Returning outcome maps to interactionId in executeNextStep.
        return {
            status: 'success',
            outcome: hasSubmitted ? 'true' : 'false',
        };
        } catch (err) {
            console.error('[CheckFormExecutor] Execution failed:', err);
            throw err; // Let flowEngine handle the error state
        }
    }
};
