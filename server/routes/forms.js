const express = require('express');
const router = express.Router();
const { supabase, supabaseAdmin } = require('../lib/supabaseClient');
const { getAuthenticatedSupabase } = require('../lib/supabaseClient');
const requireAuth = require('../middleware/requireAuth');
const { logFormBuilderEvent } = require('../utils/logger');
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
router.get('/', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
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
            .select('id, name, description, fields, styling, settings, success_message')
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
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
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
router.post('/', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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
            const { data: existing } = await supabase
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

        const { data, error } = await supabase
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
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
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

        const { data, error } = await supabase
            .from('forms')
            .update(payload)
            .eq('id', req.params.id)
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
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { error } = await supabase
            .from('forms')
            .delete()
            .eq('id', req.params.id);

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
router.post('/submit', async (req, res) => {
    try {
        const { form_token, submission_data, ip_address, user_agent } = req.body;

        if (!form_token || !submission_data) {
            return res.status(400).json({ error: 'form_token and submission_data are required' });
        }

        // Call RPC function
        const { data, error } = await supabase.rpc('submit_form', {
            p_form_token: form_token,
            p_submission_data: submission_data,
            p_ip_address: ip_address || req.ip,
            p_user_agent: user_agent || req.headers['user-agent']
        });

        if (error) {
            console.error('RPC Error:', error);
            if (error.message && error.message.includes('Form not found')) {
                return res.status(404).json({ error: 'Form not found or inactive' });
            }
            throw error;
        }

        res.json(data);


        // Explicitly update last_submission_at using admin client (bypassing RLS)
        // This ensures the timestamp is updated even if the RPC function doesn't handle it
        if (supabaseAdmin) {
            const { error: updateError } = await supabaseAdmin
                .from('forms')
                .update({
                    last_submission_at: new Date().toISOString()
                    // Note: submission_count is handled by RPC usually, so we don't touch it to avoid race conditions
                })
                .eq('form_token', form_token);

            if (updateError) {
                console.warn('Failed to update last_submission_at timestamp:', updateError.message);
            }
        }

        try {
            logFormBuilderEvent('SUBMIT_FORM', {
                token: form_token,
                submissionId: data ? data.id : 'unknown'
            });
        } catch (e) { }

        // Trigger Flow if form is connected to pipeline
        try {
            if (supabaseAdmin) {
                const { data: formData } = await supabaseAdmin
                    .from('forms')
                    .select('user_id, pipeline_id, stage_id, fields')
                    .eq('form_token', form_token)
                    .single();

                if (formData && formData.pipeline_id) {
                    // Extract phone from submission data
                    let phone = null;
                    // 1. Try to find by field type "phone"
                    if (formData.fields && Array.isArray(formData.fields)) {
                        const phoneField = formData.fields.find(f => f.type === 'phone' || f.type === 'tel');
                        if (phoneField && submission_data[phoneField.key || phoneField.id]) {
                            phone = submission_data[phoneField.key || phoneField.id];
                        }
                    }
                    // 2. Fallback: keys like 'phone', 'mobile'
                    if (!phone) {
                        const keys = Object.keys(submission_data).map(k => k.toLowerCase());
                        const phoneKey = keys.find(k => k.includes('phone') || k.includes('mobile') || k.includes('whatsapp'));
                        if (phoneKey) {
                            // Find original key
                            const originalKey = Object.keys(submission_data).find(k => k.toLowerCase() === phoneKey);
                            phone = submission_data[originalKey];
                        }
                    }

                    if (phone) {
                        flowEngine.triggerFlowByEvent(formData.user_id, phone, 'pipeline_change', {
                            pipelineId: formData.pipeline_id,
                            stageId: formData.stage_id,
                            source: 'form_builder'
                        });
                    }
                }
            }
        } catch (ignored) {
            console.error('Error triggering flow from form:', ignored);
        }
    } catch (err) {
        console.error('Error submitting form:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/forms/:id/submissions (authenticated - get form submissions)
router.get('/:id/submissions', requireAuth, async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data, error } = await supabase
            .from('form_submissions')
            .select('*')
            .eq('form_id', req.params.id)
            .order('submitted_at', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (err) {
        console.error('Error fetching submissions:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
