// TEST SCRIPT FOR WHATSAPP TEMPLATE SENDING & STATUS TRACKING
// Usage: node server/test_send_template.js
// This script sends a template and then actively polls for the message status.

const axios = require('axios');

// --- CONFIGURATION ---
const ACCESS_TOKEN = 'EAAKrV6OwdIoBQh9b9DZByOqWaWJj4k1Jt79o4u1BZBk3ZCConxkrBRcmjGDduInZCwjO5QNaXqlsTW1uAsNtxZAtja8Lj4SZA5Pdw98T1FLOLBvoi7u4SNrwi8PHyXFG1VellI0it0u8F9AanZC7uR8hbA74kIwdFmUFoZA15JPngSzGf6zRnxI56wGw3qnhDlKrJxrMz2bBX6ZCN5vmsfynDlfRy2vOhPQQQdlMMn9eD07KW5vtE2pxHRib8OaPP0i46KAwx75GZBZA1FbaLZBQnGpvSZA85g0zY3bFXHeVSDm7sAKY3OZC9m3QZDZD';
const PHONE_NUMBER_ID = '108276145517319';
const RECIPIENT_PHONE = '918408907516'; // e.g. 919876543210 (No + sign/spaces)
const TEMPLATE_NAME = 'hello'; // Using the known working template
const LANGUAGE_CODE = 'en_US';

async function sendTestMessage() {
    console.log('\n--- WhatsApp API Connection & Status Test ---\n');

    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    // Payload
    const data = {
        messaging_product: 'whatsapp',
        to: RECIPIENT_PHONE,
        type: 'template',
        template: {
            name: TEMPLATE_NAME,
            language: { code: LANGUAGE_CODE }
        }
    };

    console.log(`🚀 Sending '${TEMPLATE_NAME}' template to ${RECIPIENT_PHONE}...`);

    try {
        const response = await axios.post(url, data, {
            headers: { 'Authorization': `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' }
        });

        console.log('✅ SUCCESS! Message Sent.');

        // Extract Message ID
        const waMessageId = response.data.messages?.[0]?.id;
        console.log(`🆔 Message ID: ${waMessageId}`);

        // Note: Graph API does NOT have a simple "Get Message Status" endpoint.
        // Statuses (sent/delivered/read) are strictly delivered via Webhooks.
        // However, we can simulate checking what the server *sees* if the webhook was listening.

        console.log('\nNOTE: WhatsApp Graph API does NOT provide a direct polling endpoint for message status.');
        console.log('      Statuses (Sent, Delivered, Read) are ONLY pushed to your configured Webhook URL.');
        console.log('      Since this is a standalone script, we cannot "receive" the status here.');
        console.log('\n      Please check your Server Logs or Database (outbox tables) to confirm if the `sent` status webhook arrived.');

    } catch (error) {
        console.error('\n❌ FAILED to send message.');
        if (error.response) {
            console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error Message:', error.message);
        }
    }
}

sendTestMessage();
