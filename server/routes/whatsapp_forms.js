const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getAuthenticatedSupabase, supabaseAdmin } = require('../lib/supabaseClient');
const { logWhatsAppFormEvent } = require('../utils/logger');
const requirePermission = require('../middleware/requirePermission');

const GRAPH_API_URL = 'https://graph.facebook.com/v18.0';

// Helper to get WhatsApp Config
async function getWhatsAppConfig(supabase, userId) {
    const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !data) {
        throw new Error('WhatsApp configuration not found. Please configure your WhatsApp account in Settings.');
    }
    return data;
}

// GET / - List Flows
router.get('/', requirePermission('Whatsapp Forms', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        let wabaId = config.whatsapp_business_account_id;
        const phoneNumberId = config.phone_number_id;
        const accessToken = config.meta_access_token;

        if (!accessToken) {
            console.error('Missing Access Token');
            return res.status(400).json({ error: 'Missing WhatsApp Access Token' });
        }

        // AUTO-FIX: If we have a Phone ID, verify/fetch the correct WABA ID.
        // The error 'node type (Business)' often implies wabaId is a Business Manager ID, not WABA ID.
        if (phoneNumberId) {
            try {
                // Fetch WABA ID associated with this Phone Number
                const phoneRes = await axios.get(`${GRAPH_API_URL}/${phoneNumberId}?fields=whatsapp_business_account`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });

                const realWabaId = phoneRes.data.whatsapp_business_account?.id;

                if (realWabaId && realWabaId !== wabaId) {
                    console.log(`[WhatsAppForms] Correction: Updating WABA ID from ${wabaId} to ${realWabaId}`);
                    wabaId = realWabaId;

                    // Self-Heal: Update Database
                    await supabaseAdmin
                        .from('whatsapp_config')
                        .update({ whatsapp_business_account_id: realWabaId })
                        .eq('user_id', user.id);
                }
            } catch (resolveErr) {
                const errMsg = resolveErr.response?.data?.error?.message || resolveErr.message;
                // Only log if it's not the common permission error to keep logs clean
                if (!errMsg.includes('nonexisting field')) {
                    console.warn('[WhatsAppForms] WABA Resolution Warning:', errMsg);
                } else {
                    console.log('[WhatsAppForms] WABA Resolution skipped (permission restricted). using cached ID.');
                }
                // PROCEED with existing wabaId instead of blocking. 
                // The subsequent Flow Fetch will determine if we truly lack access.
            }
        }

        if (!wabaId) {
            return res.status(400).json({ error: 'Missing WhatsApp Business Account ID' });
        }

        const fields = 'id,name,status,categories,validation_errors,preview,updated_time';
        try {
            const response = await axios.get(`${GRAPH_API_URL}/${wabaId}/flows?fields=${fields}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            // --- Fetch Submission Counts ---
            // We aggregate counts from the database
            // const { data: counts, error } = await supabase.rpc('get_flow_submission_counts');

            // --- Fetch Submission Counts & Last Activity (Admin Bypass) ---
            // Use supabaseAdmin to bypass RLS issues for counting
            const { data: allSubmissions, error: subError } = await supabaseAdmin
                .from('whatsapp_flow_submissions')
                .select('flow_id, submitted_at');

            if (subError && subError.code !== '42P01') {
                console.error('Error fetching submission counts:', subError);
            }

            const countMap = {};
            const lastSubmissionMap = {};

            if (allSubmissions) {
                allSubmissions.forEach(sub => {
                    const fid = String(sub.flow_id);
                    // Count
                    countMap[fid] = (countMap[fid] || 0) + 1;

                    // Track latest submission
                    const currentLast = lastSubmissionMap[fid];
                    if (!currentLast || new Date(sub.submitted_at) > new Date(currentLast)) {
                        lastSubmissionMap[fid] = sub.submitted_at;
                    }
                });
            }

            const flowsWithCounts = response.data.data.map(flow => ({
                ...flow,
                // Prioritize last submission time, fallback to meta update time
                updated_at: lastSubmissionMap[flow.id] || flow.updated_time,
                last_submission_at: lastSubmissionMap[flow.id],
                submission_count: countMap[flow.id] || 0
            }));

            // Identify and Append "Ghost" Flows (Submissions without Meta Flow match)
            // e.g. "unknown_flow" or "flow_token" based submissions
            const metaFlowIds = new Set(response.data.data.map(f => f.id));
            Object.keys(countMap).forEach(flowId => {
                if (!metaFlowIds.has(flowId)) {
                    // Determine name
                    let name = (flowId === 'unknown_flow') ? 'Unknown Form' : `Flow ${flowId}`;
                    // Append artificial flow
                    flowsWithCounts.push({
                        id: flowId,
                        name: name,
                        status: 'LOCAL_ARCHIVE',
                        categories: [],
                        submission_count: countMap[flowId],
                        preview: {
                            url: null
                        }
                    });
                }
            });

            res.json({ data: flowsWithCounts, paging: response.data.paging });

        } catch (fetchErr) {
            const errMsg = fetchErr.response?.data?.error?.message || fetchErr.message;
            console.error('Error fetching flows:', errMsg);

            if (errMsg.includes('node type (Business)')) {
                return res.status(400).json({
                    error: 'Configuration Mismatch: The stored Account ID is a Business Manager ID, but a WhatsApp Business Account ID is required. Please Reconnect your account.'
                });
            }
            throw fetchErr; // Re-throw to outer catch
        }

    } catch (error) {
        console.error('Final Error in GET /flows:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// GET /:id - Get Flow Details
router.get('/:id', requirePermission('Whatsapp Forms', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;
        const fields = 'id,name,categories,preview,status,validation_errors,json_version,data_api_version,endpoint_uri,whatsapp_business_account,application,health_status';

        const response = await axios.get(`${GRAPH_API_URL}/${id}?fields=${fields}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        // Log preview data for debugging
        if (!response.data.preview) {
            console.warn(`Flow ${id} has no preview data returned from Meta.`);
        }

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching flow details:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// GET /:id/fields - Get Flow Input Fields
router.get('/:id/fields', requirePermission('Whatsapp Forms', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        // 1. Fetch Assets to get JSON URL
        const assetsResponse = await axios.get(`${GRAPH_API_URL}/${id}/assets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const jsonAsset = assetsResponse.data.data?.find(asset => asset.asset_type === 'FLOW_JSON');

        if (!jsonAsset) {
            return res.json({ fields: [] });
        }

        // 2. Download JSON
        const jsonResponse = await axios.get(jsonAsset.download_url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            responseType: 'json'
        });
        const flowJson = jsonResponse.data;
        const fields = [];

        // 3. Parse JSON for input fields
        const findInputs = (node, screenId) => {
            if (!node || typeof node !== 'object') return;
            const inputTypes = ['TextInput', 'TextArea', 'CheckboxGroup', 'RadioButtons', 'RadioButtonsGroup', 'Dropdown', 'DatePicker', 'OptIn'];
            if (inputTypes.includes(node.type) && node.name) {
                // The form builder sets the payload keys as screenId_name
                fields.push(`${screenId}_${node.name}`);
            }
            if (node.children && Array.isArray(node.children)) {
                node.children.forEach(child => findInputs(child, screenId));
            }
        };

        if (flowJson.screens) {
            flowJson.screens.forEach(screen => {
                if (screen.children) screen.children.forEach(child => findInputs(child, screen.id));
                if (screen.layout && screen.layout.children) screen.layout.children.forEach(child => findInputs(child, screen.id));
            });
        }

        const uniqueFields = [...new Set(fields)];
        console.log(`[FlowFields] Found ${uniqueFields.length} fields for flow ${id}:`, uniqueFields);
        res.json({ fields: uniqueFields });

    } catch (error) {
        console.error('Error fetching flow fields:', error.response?.data || error.message);
        res.json({ fields: [] });
    }
});

// GET /:id/start_screen - Get Flow Start Screen ID
router.get('/:id/start_screen', requirePermission('Whatsapp Forms', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        // 1. Fetch Assets to get JSON URL
        const assetsResponse = await axios.get(`${GRAPH_API_URL}/${id}/assets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const jsonAsset = assetsResponse.data.data?.find(asset => asset.asset_type === 'FLOW_JSON');

        if (!jsonAsset) {
            return res.json({ start_screen_id: 'screen_start' });
        }

        // 2. Download JSON
        const jsonResponse = await axios.get(jsonAsset.download_url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            responseType: 'json'
        });
        const flowJson = jsonResponse.data;

        // 3. Find First Screen ID
        let startScreenId = 'screen_start';
        if (flowJson.screens && flowJson.screens.length > 0) {
            // It's almost always the first screen in the array
            startScreenId = flowJson.screens[0].id;
        }

        res.json({ start_screen_id: startScreenId });

    } catch (error) {
        console.error('Error fetching flow start screen:', error.response?.data || error.message);
        // Fallback to default
        res.json({ start_screen_id: 'screen_start' });
    }
});

// POST / - Create Flow
router.post('/', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const wabaId = config.whatsapp_business_account_id;
        const accessToken = config.meta_access_token;

        if (!wabaId) {
            return res.status(400).json({ error: 'WhatsApp Business Account ID (WABA ID) is required to create flows.' });
        }

        const { name, categories, flow_json, publish } = req.body;

        const payload = {
            name,
            categories,
            publish
        };

        if (flow_json) {
            payload.flow_json = typeof flow_json === 'object' ? JSON.stringify(flow_json) : flow_json;
        }

        const response = await axios.post(`${GRAPH_API_URL}/${wabaId}/flows`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

        try {
            logWhatsAppFormEvent('CREATE_FLOW', {
                flowId: response.data.id,
                name: name
            });
        } catch (e) { }
    } catch (error) {
        console.error('Error creating flow:', error.response?.data || error.message);
        const metaError = error.response?.data?.error;
        const errorMessage = metaError?.error_user_msg || metaError?.error_user_title || metaError?.message || error.message;
        res.status(500).json({ error: errorMessage });
    }
});

// POST /:id - Update Flow Metadata (Name, Categories)
router.post('/:id', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;
        const { name, categories, endpoint_uri, application_id } = req.body;

        const payload = {};
        if (name) payload.name = name;
        if (categories) payload.categories = categories;
        if (endpoint_uri) payload.endpoint_uri = endpoint_uri;
        if (application_id) payload.application_id = application_id;

        const response = await axios.post(`${GRAPH_API_URL}/${id}`, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

        try {
            logWhatsAppFormEvent('UPDATE_FLOW_METADATA', {
                flowId: id,
                updates: Object.keys(payload)
            });
        } catch (e) { }
    } catch (error) {
        console.error('Error updating flow:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// GET /:id/json - Get Flow JSON Asset
router.get('/:id/json', requirePermission('Whatsapp Forms', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        const assetsResponse = await axios.get(`${GRAPH_API_URL}/${id}/assets`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const jsonAsset = assetsResponse.data.data?.find(asset => asset.asset_type === 'FLOW_JSON');

        if (!jsonAsset) {
            return res.status(404).json({ error: 'Flow JSON asset not found' });
        }

        const jsonResponse = await axios.get(jsonAsset.download_url, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            responseType: 'json'
        });

        res.json(jsonResponse.data);
    } catch (error) {
        console.error('Error fetching flow JSON:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// POST /:id/json - Update Flow JSON Asset
router.post('/:id/json', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;
        const { flow_json } = req.body;

        if (!flow_json) {
            return res.status(400).json({ error: 'Missing flow_json' });
        }

        const jsonString = typeof flow_json === 'object' ? JSON.stringify(flow_json, null, 2) : flow_json;

        // Use native fetch and FormData (Node 18+)
        const formData = new FormData();
        const blob = new Blob([jsonString], { type: 'application/json' });
        formData.append('file', blob, 'flow.json');
        formData.append('name', 'flow.json');
        formData.append('asset_type', 'FLOW_JSON');

        const response = await fetch(`${GRAPH_API_URL}/${id}/assets`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Failed to update flow JSON');
        }

        const data = await response.json();

        try {
            logWhatsAppFormEvent('UPDATE_FLOW_JSON', { flowId: id });
        } catch (e) { }

        res.json(data);
    } catch (error) {
        console.error('Error updating flow JSON:', error.response?.data || error.message);
        const metaError = error.response?.data?.error;
        const errorMessage = metaError?.error_user_msg || metaError?.error_user_title || metaError?.message || error.message;
        res.status(500).json({ error: errorMessage });
    }
});

// POST /:id/publish - Publish Flow
router.post('/:id/publish', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        const response = await axios.post(`${GRAPH_API_URL}/${id}/publish`, {}, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        res.json(response.data);

        try {
            logWhatsAppFormEvent('PUBLISH_FLOW', { flowId: id });
        } catch (e) { }
    } catch (error) {
        console.error('Error publishing flow:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// POST /:id/deprecate - Deprecate Flow
router.post('/:id/deprecate', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        const response = await axios.post(`${GRAPH_API_URL}/${id}/deprecate`, {}, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        res.json(response.data);

        try {
            logWhatsAppFormEvent('DEPRECATE_FLOW', { flowId: id });
        } catch (e) { }
    } catch (error) {
        console.error('Error deprecating flow:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

// DELETE /:id - Delete Flow (Only DRAFT)
router.delete('/:id', requirePermission('Whatsapp Forms', 'all_access'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        const accessToken = config.meta_access_token;
        const { id } = req.params;

        const response = await axios.delete(`${GRAPH_API_URL}/${id}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        res.json(response.data);

        try {
            logWhatsAppFormEvent('DELETE_FLOW', { flowId: id });
        } catch (e) { }
    } catch (error) {
        console.error('Error deleting flow:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});


// GET /:id/submissions - Get Submissions for a specific Flow
// GET /:id/submissions - Get Submissions for a specific Flow
router.get('/:id/submissions', requirePermission('Form Contact', 'read'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { id } = req.params;

        // Use supabaseAdmin to ensure we see all submissions irrespective of RLS for now (consistent with counts)
        const { data, error } = await supabaseAdmin
            .from('whatsapp_flow_submissions')
            .select('*')
            .eq('flow_id', id)
            .order('submitted_at', { ascending: false });

        if (error) {
            if (error.code === '42P01') return res.json([]);
            throw error;
        }
        res.json(data);
    } catch (error) {
        console.error('Error fetching flow submissions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /submissions/:id - Delete a specific submission
router.delete('/submissions/:id', requirePermission('Form Contact', 'all_access'), async (req, res) => {
    try {
        const { id } = req.params;
        // Use supabaseAdmin to allow deletion
        const { error } = await supabaseAdmin
            .from('whatsapp_flow_submissions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ message: 'Submission deleted successfully' });
    } catch (error) {
        console.error('Error deleting submission:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// POST /submissions/bulk - Bulk Delete Submissions
router.post('/submissions/bulk', requirePermission('Form Contact', 'all_access'), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'No IDs provided for deletion' });
        }

        const { error } = await supabaseAdmin
            .from('whatsapp_flow_submissions')
            .delete()
            .in('id', ids);

        if (error) throw error;
        res.json({ message: 'Submissions deleted successfully' });
    } catch (error) {
        console.error('Error bulk deleting submissions:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// PUT /submissions/:id - Update a submission
router.put('/submissions/:id', requirePermission('Form Contact', 'read_write'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Allowed fields to update
        const allowed = {};
        if (updates.contact_name !== undefined) allowed.contact_name = updates.contact_name;
        if (updates.contact_phone !== undefined) allowed.contact_phone = updates.contact_phone;
        if (updates.submission_data !== undefined) allowed.submission_data = updates.submission_data;

        const { data, error } = await supabaseAdmin
            .from('whatsapp_flow_submissions')
            .update(allowed)
            .eq('id', id)
            .select()
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            console.error(`Submission not found for update: ${id}`);
            return res.status(404).json({ error: 'Submission not found or invalid ID' });
        }

        res.json(data);
    } catch (error) {
        console.error('Error updating submission:', error);
        res.status(500).json({ error: error.message });
    }
});


// POST /:id/send - Send Flow to User
router.post('/:id/send', requirePermission('Whatsapp Forms', 'read_write'), async (req, res) => {
    try {
        const supabase = getAuthenticatedSupabase(req);
        const { data: { user } } = await supabase.auth.getUser();
        const config = await getWhatsAppConfig(supabase, user.id);

        // Use phone_number_id for sending messages
        const phoneNumberId = config.phone_number_id;
        const accessToken = config.meta_access_token;
        const { id } = req.params;
        const { phone_numbers, header_text, body_text, footer_text } = req.body;

        if (!phoneNumberId || !accessToken) {
            return res.status(400).json({ error: 'Missing Phone Number ID or Access Token' });
        }

        if (!phone_numbers || !body_text) {
            return res.status(400).json({ error: 'Phone numbers and body text are required' });
        }

        // 1. Fetch Flow JSON to get the first screen ID
        let firstScreenId = 'screen_start'; // Default fallback
        try {
            const assetsResponse = await axios.get(`${GRAPH_API_URL}/${id}/assets`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            const jsonAsset = assetsResponse.data.data?.find(asset => asset.asset_type === 'FLOW_JSON');

            if (jsonAsset) {
                // Download the JSON
                const jsonResponse = await axios.get(jsonAsset.download_url, {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    responseType: 'json'
                });

                const flowJson = jsonResponse.data;
                if (flowJson.screens && flowJson.screens.length > 0) {
                    firstScreenId = flowJson.screens[0].id;
                }
            }
        } catch (assetError) {
            console.warn('Could not fetch flow assets to determine first screen, using default:', assetError.message);
        }

        // 2. Send Message to each phone number
        const numbers = phone_numbers.split(',').map(n => n.trim()).filter(n => n);
        const results = [];

        for (const number of numbers) {
            try {
                // Call the central whatsappService to enforce ATOMIC Wallet Pre-Debit logic
                const whatsappService = require('../services/whatsappService');
                const content = {
                    type: "flow",
                    header: { type: "text", text: header_text || "Flow" },
                    body: { text: body_text },
                    footer: { text: footer_text || "" },
                    action: {
                        name: "flow",
                        parameters: {
                            flow_message_version: "3",
                            flow_token: `${Date.now()}__${id}`,
                            flow_id: id,
                            flow_cta: "Open Flow",
                            flow_action: "navigate",
                            flow_action_payload: {
                                screen: firstScreenId
                            }
                        }
                    }
                };
                
                const response = await whatsappService.sendMessage(
                    req.user.id, 
                    number, 
                    'interactive', 
                    content, 
                    phoneNumberId, 
                    false, 
                    { walletSource: 'FLOW_MANUAL_SEND' }
                );
                
                results.push({ number, status: 'success', message_id: response?.data?.messages?.[0]?.id || 'sent' });
            } catch (err) {
                console.error(`Failed to send to ${number}:`, err.response?.data || err.message);
                results.push({ number, status: 'failed', error: err.response?.data?.error?.message || err.message });
            }
        }

        res.json({ results });

        try {
            logWhatsAppFormEvent('SEND_FLOW', {
                flowId: id,
                recipientCount: numbers.length,
                status: results.filter(r => r.status === 'success').length > 0 ? 'PARTIAL_SUCCESS' : 'FAILED'
            });
        } catch (e) { }

    } catch (error) {
        console.error('Error sending flow:', error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data?.error?.message || error.message });
    }
});

module.exports = router;