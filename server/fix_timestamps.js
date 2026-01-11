const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

async function fixLastSubmissionDates() {
    console.log('--- FIXING LAST SUBMISSION DATES ---');

    if (!supabaseAdmin) {
        console.error('❌ supabaseAdmin not available.');
        return;
    }

    try {
        // 1. Get all forms
        const { data: forms, error: formsError } = await supabaseAdmin
            .from('forms')
            .select('id, name, last_submission_at');

        if (formsError) throw formsError;

        console.log(`Found ${forms.length} forms.`);

        for (const form of forms) {
            // 2. Get the latest submission for this form
            const { data: latestSub, error: subError } = await supabaseAdmin
                .from('form_submissions')
                .select('submitted_at')
                .eq('form_id', form.id)
                .order('submitted_at', { ascending: false })
                .limit(1)
                .single();

            if (latestSub) {
                console.log(`Form "${form.name}" last submitted: ${latestSub.submitted_at}`);

                // 3. Update the form if needed
                if (form.last_submission_at !== latestSub.submitted_at) {
                    console.log('Updating form timestamp...');
                    await supabaseAdmin
                        .from('forms')
                        .update({ last_submission_at: latestSub.submitted_at })
                        .eq('id', form.id);
                    console.log('✅ Updated.');
                } else {
                    console.log('Timestamp already up to date.');
                }
            } else {
                console.log(`Form "${form.name}" has no submissions.`);
            }
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

fixLastSubmissionDates();
