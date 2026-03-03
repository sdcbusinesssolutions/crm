const whatsappService = require('../../whatsappService');


class SendFlowExecutor {
    async execute(session, node, context) {
        console.log(`[SendFlowExecutor] Executing node ${node.id}`);
        const { user_id, contact_phone, id: sessionId } = session;
        const { flowId, headerText, bodyText, footerText, ctaText, ifUnresponsive, unresponsiveTimeout } = node.data;

        if (!flowId) {
            console.error(`[SendFlowExecutor] No Flow ID configured for node ${node.id}`);
            return { status: 'failed', reason: 'missing_flow_id' };
        }

        // EXPLANATION:
        // flow_id: This is the unique identifier of the WhatsApp Flow created in Meta Business Manager.
        //          It is selected by the user in the Settings Panel from the list of available flows.

        // flow_token: A unique string developer generates to track this specific flow session.
        //             When the user completes the flow, this token is returned in the webhook.
        //             We use `flow_${sessionId}_${node.id}__${flowId}` to link the response back to this specific user session, node AND specific flow version.
        const flowToken = `flow_${sessionId}_${node.id}__${flowId}`;

        const interactiveMessage = {
            type: 'flow',
            header: headerText ? { type: 'text', text: headerText } : undefined,
            body: { text: bodyText || 'Please complete this form' },
            footer: footerText ? { text: footerText } : undefined,
            action: {
                name: 'flow',
                parameters: {
                    flow_message_version: '3',
                    flow_token: flowToken,
                    flow_id: flowId,
                    flow_cta: ctaText || 'Open Form'
                }
            }
        };

        try {
            console.log(`[SendFlowExecutor] Sending Flow to ${contact_phone}. Payload:`, JSON.stringify(interactiveMessage, null, 2));
            const response = await whatsappService.sendMessage(user_id, contact_phone, 'interactive', interactiveMessage);
            console.log(`[SendFlowExecutor] Flow message sent. ID: ${response?.messages?.[0]?.id}`);

            // Calculate Timeout if enabled
            let timeoutAt = undefined;
            if (ifUnresponsive && unresponsiveTimeout) {
                // Robust parsing of timeout string (e.g. "30 Minutes" or just "30")
                const parts = unresponsiveTimeout.trim().split(/\s+/);
                const valStr = parts[0];
                const unit = parts.length > 1 ? parts[1] : 'min'; // Default to minutes if unit missing

                const val = parseFloat(valStr);
                let ms = 0;

                if (!isNaN(val)) {
                    if (unit.toLowerCase().includes('min')) ms = val * 60 * 1000;
                    else if (unit.toLowerCase().includes('hr')) ms = val * 60 * 60 * 1000;
                    else if (unit.toLowerCase().includes('day')) ms = val * 24 * 60 * 60 * 1000;
                    else ms = val * 60 * 1000; // Fallback to minutes
                }

                if (ms > 0) {
                    timeoutAt = new Date(Date.now() + ms).toISOString();
                    console.log(`[SendFlowExecutor] Timeout set for ${ms}ms. Expires at: ${timeoutAt}`);
                }
            }

            // Important: We return PAUSE because we are waiting for the user to fill the flow.
            // The FlowEngine will update the session status to 'waiting_input'.
            // When the user submits the flow, the webhook handler will resume the flow.
            return {
                __action: 'PAUSE',
                status: 'sent',
                isFilled: false,
                messageId: response?.messages?.[0]?.id,
                flowToken: flowToken,
                timestamp: new Date().toISOString(),
                timeoutAt: timeoutAt
            };

        } catch (error) {
            console.error(`[SendFlowExecutor] Failed to send flow message:`, error.message);
            // If sending fails, we probably shouldn't pause, but rather fail or continue.
            // For now, let's throw so the engine handles the error state.
            throw error;
        }
    }

    async validate(session, node, response) {
        // The flowToken generated and sent to the user was saved in the session variables during execute()
        const expectedToken = session.variables[node.id]?.flowToken;

        // We look for the flow_token returned by Meta in the actual payload (which is parsed into response here)
        // If it's a valid form submission, response will be an object containing the keys from the form, PLUS flow_token.
        const receivedToken = typeof response === 'object' && response !== null ? response.flow_token : null;

        if (!receivedToken || receivedToken !== expectedToken) {
            console.warn(`[SendFlowExecutor] Invalid input received during form submission wait. Expected flow_token: ${expectedToken}, got: ${receivedToken}. Ignoring input.`);
            // Returning IGNORE forces the engine to STOP executing this node's continuation.
            // It will just drop the message and leave the user parked at this node until they actually return a valid form.
            return { valid: false, action: 'IGNORE' };
        }

        return { valid: true };
    }
}

module.exports = new SendFlowExecutor();
