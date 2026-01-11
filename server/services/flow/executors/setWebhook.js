/**
 * Set Webhook Executor
 * 
 * This node pauses the flow and waits for an external POST request.
 * The external request must hit /api/webhooks/:phoneNumberId/:webhookId/webhook
 */
const execute = async (session, node, context) => {
    console.log(`[SetWebhook] Pausing flow at node ${node.id}. Waiting for external webhook ${node.data.webhookId}...`);

    // We return PAUSE to tell the FlowEngine to stop execution and set status to 'waiting_input'.
    // The flow will be resumed by the incoming_webhooks.js route handler.
    return {
        __action: 'PAUSE',
        webhookId: node.data.webhookId,
        url: node.data.url,
        method: node.data.method
    };
};

module.exports = { execute };
