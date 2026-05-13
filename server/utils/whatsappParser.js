/**
 * Normalizes WhatsApp Message Object
 * Handles all message types: text, image, video, document, audio, sticker, location, contacts, interactive
 */
const extractMessageContent = (message) => {
    const type = message.type;
    const base = {
        type,
        id: message.id,
        timestamp: message.timestamp,
        from: message.from,
        raw: message
    };

    switch (type) {
        case 'text':
            return { ...base, text: message.text.body };

        case 'image':
            return {
                ...base,
                mediaId: message.image.id,
                caption: message.image.caption || '',
                mimeType: message.image.mime_type,
                sha256: message.image.sha256
            };

        case 'video':
            return {
                ...base,
                mediaId: message.video.id,
                caption: message.video.caption || '',
                mimeType: message.video.mime_type
            };

        case 'document':
            return {
                ...base,
                mediaId: message.document.id,
                filename: message.document.filename || '',
                caption: message.document.caption || '',
                mimeType: message.document.mime_type
            };

        case 'audio':
            return {
                ...base,
                mediaId: message.audio.id,
                voice: message.audio.voice || false,
                mimeType: message.audio.mime_type
            };

        case 'sticker':
            return {
                ...base,
                mediaId: message.sticker.id,
                animated: message.sticker.animated || false,
                mimeType: message.sticker.mime_type
            };

        case 'location':
            return {
                ...base,
                location: {
                    latitude: message.location.latitude,
                    longitude: message.location.longitude,
                    name: message.location.name || '',
                    address: message.location.address || ''
                }
            };

        case 'contacts':
            return {
                ...base,
                contacts: message.contacts // Array of contact objects
            };

        case 'interactive':
            const interactive = message.interactive;
            let interactionData = {};

            if (interactive.type === 'button_reply') {
                interactionData = {
                    subtype: 'button_reply',
                    id: interactive.button_reply.id,
                    title: interactive.button_reply.title
                };
            } else if (interactive.type === 'list_reply') {
                interactionData = {
                    subtype: 'list_reply',
                    id: interactive.list_reply.id,
                    title: interactive.list_reply.title,
                    description: interactive.list_reply.description
                };
            } else if (interactive.type === 'nfm_reply') {
                let responseJson = interactive.nfm_reply.response_json;
                try {
                    if (typeof responseJson === 'string') {
                        responseJson = JSON.parse(responseJson);
                    }
                } catch (e) {
                    console.error('Error parsing nfm_reply response_json:', e);
                }

                interactionData = {
                    subtype: 'nfm_reply',
                    response_json: responseJson,
                    body: interactive.nfm_reply.body,
                    name: interactive.nfm_reply.name
                };
            } else {
                interactionData = { subtype: interactive.type, data: interactive };
            }

            return {
                ...base,
                interactive: interactionData
            };

        case 'button': // Legacy template buttons
            return {
                ...base,
                button: {
                    text: message.button.text,
                    payload: message.button.payload
                }
            };

        case 'reaction':
            return {
                ...base,
                reaction: {
                    messageId: message.reaction.message_id,
                    emoji: message.reaction.emoji
                }
            };
 
        case 'edit':
            return {
                ...base,
                edit: true,
                originalMessageId: message.edit?.original_message_id,
                text: message.edit?.message?.text?.body || message.edit?.message?.image?.caption || message.edit?.message?.video?.caption || ''
            };
 
        case 'revoke':
            return {
                ...base,
                revoke: true,
                originalMessageId: message.revoke?.original_message_id
            };
 
        default:
            return { ...base, unknown: true };
    }
};

module.exports = { extractMessageContent };
