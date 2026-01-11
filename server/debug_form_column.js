const { supabase, supabaseAdmin } = require('./lib/supabaseClient');

async function debugFormColumn() {
    console.log('--- DEBUG FORM COLUMN ---');

    // 1. Check if we can select 'last_submission_at' from the first form found via Admin
    if (!supabaseAdmin) {
        console.error('❌ supabaseAdmin is NOT initialized (Service Key missing?)');
    } else {
        console.log('✅ supabaseAdmin is initialized');
    }

    try {
        const { data: forms, error: selectError } = await supabaseAdmin
            .from('forms')
            .select('*') // Select all to see keys
            .limit(1);

        if (selectError) {
            console.error('Error selecting forms:', selectError);
        } else if (forms && forms.length > 0) {
            const form = forms[0];
            console.log('Found Form:', { id: form.id, name: form.name });
            console.log('Form Keys:', Object.keys(form));

            if ('last_submission_at' in form) {
                console.log('✅ Column "last_submission_at" EXISTS in schema.');
                console.log('Current Value:', form.last_submission_at);
            } else {
                console.error('❌ Column "last_submission_at" DOES NOT EXIST in returned object.');
            }

            // 2. Try to update it manually
            console.log('Attempting manual update...');
            const { data: updateData, error: updateError } = await supabaseAdmin
                .from('forms')
                .update({ last_submission_at: new Date().toISOString() })
                .eq('id', form.id)
                .select();

            if (updateError) {
                console.error('❌ Update failed:', updateError);
            } else {
                console.log('✅ Update successful. New Value:', updateData[0]?.last_submission_at);
            }

        } else {
            console.log('No forms found to test.');
        }

    } catch (e) {
        console.error('Unexpected error:', e);
    }
}

debugFormColumn();
