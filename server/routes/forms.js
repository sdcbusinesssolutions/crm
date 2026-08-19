const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { logFormBuilderEvent } = require('../utils/logger');
const requirePermission = require('../middleware/requirePermission');
const flowEngine = require('../services/flowEngine');

// Helper function to generate unique form token
function generateFormToken() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 8; i++) {
        token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
}

// GET /api/forms (authenticated - get user's forms)
router.get('/', requireAuth, requirePermission(['Form Builder', 'Pipelines', 'Contact List'], 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('forms')
            .select('*')
            .eq('user_id', req.user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching forms:', err);
        if (err.code === '42P01' || (err.message && err.message.includes('does not exist'))) {
            return res.json([]);
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/forms/token/:token (public - get form by token for submission)
router.get('/token/:token', async (req, res) => {
    try {
        // Use public supabase client (no auth required)
        const { data, error } = await supabase
            .from('forms')
            .select('id, name, description, fields, styling, settings, success_message, success_redirect_url')
            .eq('form_token', req.params.token)
            .eq('is_active', true)
            .single();

        if (error) throw error;
        if (!data) {
            return res.status(404).json({ error: 'Form not found' });
        }

        res.json(data);
    } catch (err) {
        console.error('Error fetching form by token:', err);
        res.status(404).json({ error: 'Form not found' });
    }
});

// GET /api/forms/:id (authenticated - get specific form)
router.get('/:id', requireAuth, requirePermission('Form Builder', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('forms')
            .select('*')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (err) {
        console.error('Error fetching form:', err);
        res.status(500).json({ error: err.message });
    }
});



// POST /api/forms (authenticated - create new form)
router.post('/', requireAuth, requirePermission('Form Builder', 'read_write'), async (req, res) => {
    try {
        const user = req.user;

        if (!user || !user.id) {
            return res.status(401).json({ error: 'User context missing' });
        }

        const {
            name,
            description,
            fields,
            pipeline_id,
            stage_id,
            styling,
            settings,
            success_message,
            success_redirect_url,
            default_tags,
            default_group_ids,
            default_owner_id
        } = req.body;

        // Generate unique token
        let form_token = generateFormToken();

        // Check if token exists and regenerate if needed
        let tokenExists = true;
        let attempts = 0;
        while (tokenExists && attempts < 10) {
            const { data: existing } = await supabaseAdmin
                .from('forms')
                .select('id')
                .eq('form_token', form_token)
                .single();

            if (!existing) {
                tokenExists = false;
            } else {
                form_token = generateFormToken();
                attempts++;
            }
        }

        const { data, error } = await supabaseAdmin
            .from('forms')
            .insert([{
                user_id: user.id,
                name: name || 'New Form',
                description: description || '',
                form_token,
                is_active: true,
                fields: fields || [],
                pipeline_id: pipeline_id || null,
                stage_id: stage_id || null,
                styling: styling || {},
                settings: settings || {},
                success_message: success_message || 'Thank you for your submission!',
                success_redirect_url: success_redirect_url || null,
                default_group_ids: default_group_ids || [],
                default_tags: default_tags || [],
                default_owner_id: default_owner_id || null,
                submission_count: 0
            }])
            .select()
            .single();

        if (error) throw error;

        try {
            logFormBuilderEvent('CREATE_FORM', {
                formId: data.id,
                name: data.name
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error creating form:', err);
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/forms/:id (authenticated - update form)
router.put('/:id', requireAuth, requirePermission('Form Builder', 'read_write'), async (req, res) => {
    try {
        const {
            name,
            description,
            fields,
            pipeline_id,
            stage_id,
            styling,
            settings,
            success_message,
            success_redirect_url,
            is_active,
            default_tags,
            default_group_ids,
            default_owner_id
        } = req.body;

        const payload = {};
        if (name !== undefined) payload.name = name;
        if (description !== undefined) payload.description = description;
        if (fields !== undefined) payload.fields = fields;
        if (pipeline_id !== undefined) payload.pipeline_id = pipeline_id;
        if (stage_id !== undefined) payload.stage_id = stage_id;
        if (styling !== undefined) payload.styling = styling;

        if (settings !== undefined) payload.settings = settings;

        if (success_message !== undefined) payload.success_message = success_message;
        if (success_redirect_url !== undefined) payload.success_redirect_url = success_redirect_url;
        if (is_active !== undefined) payload.is_active = is_active;
        if (default_tags !== undefined) payload.default_tags = default_tags;
        if (default_group_ids !== undefined) payload.default_group_ids = default_group_ids;
        if (default_owner_id !== undefined) payload.default_owner_id = default_owner_id;

        const { data, error } = await supabaseAdmin
            .from('forms')
            .update(payload)
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .select()
            .single();

        if (error) throw error;

        try {
            logFormBuilderEvent('UPDATE_FORM', {
                formId: req.params.id,
                updates: Object.keys(payload)
            });
        } catch (e) { }

        res.json(data);
    } catch (err) {
        console.error('Error updating form:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/forms/:id (authenticated - delete form)
router.delete('/:id', requireAuth, requirePermission('Form Builder', 'all_access'), async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('forms')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;

        try {
            logFormBuilderEvent('DELETE_FORM', { formId: req.params.id });
        } catch (e) { }

        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting form:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/forms/submit (public - submit form)
// POST /api/forms/submit (public - submit form)
router.post('/submit', async (req, res) => {
    try {
        // Use Admin Client for all operations since this is a public endpoint
        const supabase = supabaseAdmin;
        if (!supabase) {
            console.error('SERVER ERROR: Supabase Service Key not loaded');
            return res.status(500).json({ error: 'Server misconfiguration' });
        }

        const { form_token, submission_data, ip_address, user_agent } = req.body;

        if (!form_token || !submission_data) {
            return res.status(400).json({ error: 'form_token and submission_data are required' });
        }

        // 1. Fetch Form Definition
        const { data: form, error: formError } = await supabase
            .from('forms')
            .select('*, pipelines(name), pipeline_stages(name)')
            .eq('form_token', form_token)
            .single();

        if (formError || !form) {
            return res.status(404).json({ error: 'Form not found or inactive' });
        }

        // 2. Extract Contact Information
        let contactInfo = {
            name: submission_data.name || submission_data.full_name || submission_data['First Name'] || 'Unknown',
            email: null,
            phone: null,
            company: submission_data.company || submission_data.organization || null
        };

        // Smart Field Extraction
        const keys = Object.keys(submission_data);
        for (const key of keys) {
            const lowerKey = key.toLowerCase();
            const value = submission_data[key];
            if (!value) continue;

            if (!contactInfo.email && (lowerKey.includes('email') || (typeof value === 'string' && value.includes('@')))) {
                contactInfo.email = value;
            }
            if (!contactInfo.phone && (lowerKey.includes('phone') || lowerKey.includes('mobile') || lowerKey.includes('whatsapp') || lowerKey.includes('tel'))) {
                contactInfo.phone = value;
            }
            if (contactInfo.name === 'Unknown' && (lowerKey.includes('name') && !lowerKey.includes('company'))) {
                contactInfo.name = value;
            }
        }

        // 3. Save Submission
        const { data: submission, error: subError } = await supabase
            .from('form_submissions')
            .insert([{
                form_id: form.id,
                submission_data: submission_data,
                ip_address: ip_address || req.ip,
                user_agent: user_agent || req.headers['user-agent'],
                submitted_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (subError) throw subError;

        // 4. Handle Contact Creation/Update
        if (contactInfo.phone || contactInfo.email) {
            // Try to find existing contact
            // Try to find existing contact by Phone then Email
            let existingContact = null;

            if (contactInfo.phone) {
                const { data } = await supabase.from('contacts')
                    .select('id, group_ids, tags')
                    .eq('user_id', form.user_id)
                    .eq('phone', contactInfo.phone)
                    .maybeSingle();
                if (data) existingContact = data;
            }

            if (!existingContact && contactInfo.email) {
                const { data } = await supabase.from('contacts')
                    .select('id, group_ids, tags')
                    .eq('user_id', form.user_id)
                    .eq('email', contactInfo.email)
                    .maybeSingle();
                if (data) existingContact = data;
            }

            let contactId = existingContact?.id;
            let groupIds = existingContact?.group_ids || [];
            let tags = existingContact?.tags || [];

            // Merge Groups
            if (form.default_group_ids && Array.isArray(form.default_group_ids)) {
                form.default_group_ids.forEach(gid => {
                    if (!groupIds.includes(gid)) groupIds.push(gid);
                });
            }

            // Merge Tags
            if (form.default_tags && Array.isArray(form.default_tags)) {
                form.default_tags.forEach(t => {
                    if (!tags.includes(t)) tags.push(t);
                });
            }

            if (existingContact) {
                // UPDATE
                await supabase
                    .from('contacts')
                    .update({
                        group_ids: groupIds,
                        tags: tags,
                        updated_at: new Date().toISOString()
                        // Don't overwrite name/email/phone as existing might be better, or make it optional?
                        // For now, let's strictly ADD groups/tags.
                    })
                    .eq('id', existingContact.id);
            } else {
                // CREATE
                const { data: newContact, error: createError } = await supabase
                    .from('contacts')
                    .insert([{
                        user_id: form.user_id,
                        name: contactInfo.name,
                        email: contactInfo.email,
                        phone: contactInfo.phone,
                        status: 'active',
                        source: 'form_builder',
                        group_ids: groupIds,
                        tags: tags,
                        custom_data: { source_form: form.name }
                    }])
                    .select()
                    .single();

                if (createError) {
                    console.error('Failed to create contact from form:', createError);
                } else {
                    contactId = newContact.id;
                }
            }

            // 5. Handle Pipeline Lead
            if (form.pipeline_id) {
                let existingLeads = null;

                // 1. Try checking by phone first (primary identifier in WhatsApp CRM)
                if (contactInfo.phone) {
                    const { data } = await supabase
                        .from('leads')
                        .select('id')
                        .eq('pipeline_id', form.pipeline_id)
                        .eq('phone', contactInfo.phone);
                    if (data && data.length > 0) existingLeads = data;
                }

                // 2. If not found by phone, try checking by email
                if ((!existingLeads || existingLeads.length === 0) && contactInfo.email) {
                    const { data } = await supabase
                        .from('leads')
                        .select('id')
                        .eq('pipeline_id', form.pipeline_id)
                        .eq('email', contactInfo.email);
                    if (data && data.length > 0) existingLeads = data;
                }

                if (!existingLeads || existingLeads.length === 0) {
                    const { error: leadError } = await supabase
                        .from('leads')
                        .insert([{
                            user_id: form.user_id,
                            // contact_id: contactId, // Column may not exist in this schema setup
                            pipeline_id: form.pipeline_id,
                            stage_id: form.stage_id,
                            name: contactInfo.name,
                            email: contactInfo.email,
                            phone: contactInfo.phone,
                            company: contactInfo.company,
                            source: 'From Form: ' + form.name,
                            status: 'active',
                            estimated_value: 0
                        }]);
                    if (leadError) console.error('Failed to create lead:', leadError);
                } else {
                    // Update existing lead to the new stage
                    const existingLeadId = existingLeads[0].id;
                    const { error: updateError } = await supabase
                        .from('leads')
                        .update({
                            stage_id: form.stage_id,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', existingLeadId);
                        
                    if (updateError) console.error('Failed to update existing lead:', updateError);
                }
            }

            // 6. Trigger Automations (Flow Engine)
            if (contactInfo.phone && form.pipeline_id) {
                try {
                    flowEngine.triggerFlowByEvent(form.user_id, contactInfo.phone, 'pipeline_change', {
                        pipelineId: form.pipeline_id,
                        stageId: form.stage_id,
                        pipelineName: form.pipelines ? form.pipelines.name : '',
                        stageName: form.pipeline_stages ? form.pipeline_stages.name : '',
                        source: 'form_builder'
                    });
                } catch (e) { console.error('Flow Trigger Error', e); }
            }
        }

        // 7. Update Form Stats
        await supabase
            .from('forms')
            .update({
                submission_count: (form.submission_count || 0) + 1,
                last_submission_at: new Date().toISOString()
            })
            .eq('id', form.id);

        try {
            logFormBuilderEvent('SUBMIT_FORM', {
                token: form_token,
                submissionId: submission.id
            });
        } catch (e) { }

        // Response
        if (form.settings?.success_redirect_url) {
            res.json({ redirect: form.settings.success_redirect_url });
        } else {
            res.json({ message: form.settings?.success_message || 'Thank you!' });
        }

    } catch (err) {
        console.error('Error submitting form:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/forms/:id/submissions (authenticated - get form submissions)
router.get('/:id/submissions', requireAuth, requirePermission('Form Builder', 'read'), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const from = (page - 1) * limit;
        const to = from + limit - 1;

        // Verify form ownership first
        const { data: form, error: formError } = await supabaseAdmin
            .from('forms')
            .select('id')
            .eq('id', req.params.id)
            .eq('user_id', req.user.id)
            .single();

        if (formError || !form) {
            return res.status(404).json({ error: 'Form not found or unauthorized' });
        }

        // Fetch submissions
        const { data, count, error } = await supabaseAdmin
            .from('form_submissions')
            .select('*', { count: 'exact' })
            .eq('form_id', req.params.id)
            .order('submitted_at', { ascending: false })
            .range(from, to);

        if (error) throw error;
        
        res.json({
            data: data || [],
            total: count || 0,
            page,
            totalPages: Math.ceil((count || 0) / limit)
        });
    } catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/forms/:formId/submissions/:id (authenticated - delete form submission)
router.delete('/:formId/submissions/:id', requireAuth, requirePermission('Form Builder', 'all_access'), async (req, res) => {
    try {
        // Verify form ownership first
        const { data: form, error: formError } = await supabaseAdmin
            .from('forms')
            .select('id')
            .eq('id', req.params.formId)
            .eq('user_id', req.user.id)
            .single();

        if (formError || !form) {
            return res.status(404).json({ error: 'Form not found or unauthorized' });
        }

        const { error } = await supabaseAdmin
            .from('form_submissions')
            .delete()
            .eq('id', req.params.id)
            .eq('form_id', req.params.formId);

        if (error) throw error;
        
        logFormBuilderEvent('DELETE_FORM_SUBMISSION', { formId: req.params.formId, submissionId: req.params.id });
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting submission:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
