const express = require('express');
const router = express.Router();
const { supabaseAdmin, supabase } = require('../lib/supabaseClient');
const flowEngine = require('../services/flowEngine');
const { flattenObject, flattenJSON } = require('../utils/objectUtils');

/**
 * Incoming Webhook for Flow Steps
 * URL: /api/webhooks/:phoneNumberId/:webhookId/webhook
 * 
 * This endpoint allows external services to trigger or resume a flow step.
 * The request body MUST contain 'contact_phone' to identify the user session.
 */
router.post('/:phoneNumberId/:webhookId/webhook', async (req, res) => {
    const { phoneNumberId, webhookId } = req.params;
    const payload = req.body;

    console.log(`[IncomingWebhook] Received POST for ${webhookId} (PhoneID: ${phoneNumberId})`);
    console.log('Payload:', JSON.stringify(payload, null, 2));

    try {
        const rpcClient = supabaseAdmin || supabase;

        // 0. Log the incoming webhook immediately for debugging/capture
        // ONLY log if it is explicitly a debug request OR if global status logging is ON.
        // We keep it on for 'flow_trigger' message type to support the 'Capture Response' UI.
        try {
            if (process.env.ENABLE_STATUS_LOGGING === 'true' || req.query.debug === 'true' || true) { // Defaulting 'true' for now to protect UI
                await rpcClient.rpc('log_webhook_event', {
                    p_phone_number_id: phoneNumberId,
                    p_webhook_id: webhookId,
                    p_http_method: 'POST',
                    p_raw_payload: payload,
                    p_processed_status: 'pending',
                    p_message_type: 'flow_trigger',
                    p_sender_phone: payload.contact_phone || payload.phone || payload.mobile || payload.from
                });
            }
        } catch (logError) {
            console.error('[IncomingWebhook] Failed to log webhook:', logError);
        }

        // 1. Validate Payload
        const contactPhone = payload.contact_phone || payload.phone || payload.recipient_phone || payload.to || payload.mobile || payload.email;

        if (!contactPhone) {
            return res.status(400).json({ error: 'Missing contact_phone (or to, mobile, email) in request body.' });
        }

        // 2. Check for Active Session
        const { data: sessions, error: sessionError } = await rpcClient
            .from('flow_sessions')
            .select('*')
            .eq('contact_phone', contactPhone)
            .in('status', ['waiting_input', 'active'])
            .order('created_at', { ascending: false })
            .limit(1);

        let session = null;
        let flow = null;
        let currentNode = null;

        if (sessions && sessions.length > 0) {
            // --- SCENARIO A: RESUME EXISTING SESSION ---
            session = sessions[0];
            console.log(`[IncomingWebhook] Found active session: ${session.id}`);

            // Fetch Flow
            const { data: flowData, error: flowError } = await rpcClient.rpc('get_flow_by_id', { p_flow_id: session.flow_id });
            if (flowError || !flowData || flowData.length === 0) return res.status(500).json({ error: 'Flow definition not found.' });
            flow = flowData[0];
            currentNode = flow.nodes.find(n => n.id === session.current_node_id);

            // Verify Webhook ID match
            if (currentNode?.data?.webhookId !== webhookId) {
                console.warn(`[IncomingWebhook] Mismatch: Session at ${currentNode?.id} (Webhook: ${currentNode?.data?.webhookId}), req: ${webhookId}`);
                return res.status(409).json({ error: 'User is in a different flow step.' });
            }

        } else {
            // --- SCENARIO B: START NEW SESSION (TRIGGER) ---
            console.log(`[IncomingWebhook] No active session. Attempting to trigger new flow for ${webhookId}`);

            // 1. Get User ID
            let userId = null;

            // Attempt A: Lookup by Phone Number ID (Fastest)
            const { data: configData, error: configError } = await rpcClient
                .from('whatsapp_config')
                .select('user_id')
                .eq('phone_number_id', phoneNumberId)
                .single();

            if (configData) {
                userId = configData.user_id;
                console.log(`[IncomingWebhook] Found User ID via Config: ${userId}`);
            } else {
                console.warn(`[IncomingWebhook] WhatsApp config lookup failed for ${phoneNumberId}. Falling back to global flow search.`);
            }

            // 2. Find Flow
            if (userId) {
                // Search flows for this specific user
                const { data: allFlows, error: flowsError } = await rpcClient
                    .from('flows')
                    .select('*')
                    .eq('user_id', userId);

                if (flowsError || !allFlows) {
                    console.error('[IncomingWebhook] Error fetching flows:', flowsError);
                    return res.status(500).json({ error: 'Error fetching flows.' });
                }

                for (const f of allFlows) {
                    if (!f.nodes || !Array.isArray(f.nodes)) continue;
                    const node = f.nodes.find(n => n.data && n.data.webhookId === webhookId);
                    if (node) {
                        flow = f;
                        currentNode = node;
                        break;
                    }
                }
            } else {
                // Fallback: Search ALL flows for this webhookId using Secure RPC
                // This bypasses RLS issues if SUPABASE_SERVICE_KEY is missing
                const { data: foundFlows, error: searchError } = await rpcClient.rpc('find_flow_by_webhook_id', {
                    p_webhook_id: webhookId
                });

                if (searchError) {
                    console.error('[IncomingWebhook] Global flow search error:', searchError);
                }

                if (foundFlows && foundFlows.length > 0) {
                    flow = foundFlows[0];
                    userId = flow.user_id; // Found the user!
                    currentNode = flow.nodes.find(n => n.data && n.data.webhookId === webhookId);
                    console.log(`[IncomingWebhook] Found Flow via Fallback Search: ${flow.name} (User: ${userId})`);
                }
            }

            if (!flow || !currentNode) {
                console.warn(`[IncomingWebhook] Webhook ID ${webhookId} not found in any flow.`);
                // Even if flow not found, we logged it.
                return res.status(404).json({ error: 'No flow found with this Webhook ID.' });
            }

            console.log(`[IncomingWebhook] Found Trigger Flow: ${flow.name}, Node: ${currentNode.id}`);

            // 3. Create New Session
            // ATOMIC SAFEGUARD: In a multi-container environment, two identical webhooks
            // might arrive at the exact same millisecond. 
            
            // A. Cancel any old sessions first
            await rpcClient.rpc('cancel_active_sessions', { p_contact_phone: contactPhone });

            // B. Wait a tiny amount (50ms) to let DB settle across nodes
            await new Promise(r => setTimeout(r, 50));

            // C. Final check: Did another container just start a session?
            const { data: doubleCheck } = await rpcClient
                .from('flow_sessions')
                .select('id')
                .eq('contact_phone', contactPhone)
                .in('status', ['waiting_input', 'active', 'processing'])
                .single();

            if (doubleCheck) {
                console.warn(`[IncomingWebhook] Race Condition Avoided: Session already created via other container for ${contactPhone}.`);
                return res.json({ status: 'success', message: 'Flow already processing.' });
            }

            // Flatten payload to ensure nested fields are accessible
            const flattenedPayload = flattenObject(payload);
            const dotNotationPayload = flattenJSON(payload);
            const initialContext = {
                trigger: { ...payload, ...flattenedPayload, ...dotNotationPayload, timestamp: new Date().toISOString() },
                [currentNode.id]: { response: { ...payload, ...flattenedPayload, ...dotNotationPayload }, timestamp: new Date().toISOString() }
            };

            const { data: newSession, error: createError } = await rpcClient.rpc('create_flow_session', {
                p_user_id: userId,
                p_contact_phone: contactPhone,
                p_flow_id: flow.id,
                p_current_node_id: currentNode.id,
                p_variables: initialContext
            });

            if (createError) {
                console.error('[IncomingWebhook] Failed to create session (might be concurrent block):', createError);
                return res.status(500).json({ error: 'Failed to create flow session.' });
            }

            session = newSession;
        }

        // --- COMMON: EXECUTE NEXT STEP ---

        // If we resumed, we need to update variables with the payload
        if (sessions && sessions.length > 0) {
            const context = session.variables || {};
            // Flatten payload for resumed session
            const flattenedPayload = flattenObject(payload);
            const dotNotationPayload = flattenJSON(payload);
            const updatedContext = {
                ...context,
                [currentNode.id]: {
                    ...context[currentNode.id],
                    response: { ...payload, ...flattenedPayload, ...dotNotationPayload },
                    timestamp: new Date().toISOString()
                }
            };
            await rpcClient.rpc('update_session_variables', {
                p_session_id: session.id,
                p_variables: updatedContext
            });
            session.variables = updatedContext;
        }

        console.log(`[IncomingWebhook] Resuming/Starting flow for session ${session.id} from node ${currentNode.id}`);
        await flowEngine.executeNextStep(session, flow, currentNode.id);

        return res.json({ status: 'success', message: 'Flow processed.' });

    } catch (error) {
        console.error('[IncomingWebhook] Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

/**
 * GET /api/webhooks/:webhookId/latest
 * Retrieve the latest captured payload for a specific webhook ID.
 * Used by the Flow Builder UI to "Capture Response".
 */
router.get('/:webhookId/latest', async (req, res) => {
    const { webhookId } = req.params;
    const rpcClient = supabaseAdmin || supabase;

    try {
        // Use RPC to bypass RLS since we might not have the service key
        const { data, error } = await rpcClient.rpc('get_latest_webhook_log', {
            p_webhook_id: webhookId
        });

        if (error) {
            console.error('Error fetching latest webhook:', error);
            return res.status(500).json({ error: 'Database error' });
        }

        if (!data || data.length === 0) {
            return res.json({ found: false });
        }

        // RPC returns an array
        const latest = data[0];
        return res.json({ found: true, payload: latest.raw_payload, timestamp: latest.created_at });

    } catch (e) {
        console.error('Server error fetching latest webhook:', e);
        res.status(500).json({ error: 'Server error' });
    }
});


module.exports = router;
