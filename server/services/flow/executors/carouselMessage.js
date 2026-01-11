const whatsappService = require('../../whatsappService');

const execute = async (session, node, context) => {
    try {
        const { user_id, contact_phone } = session;
        const { data } = node;

        // 1. Validate Payload
        if (!data.cards || !Array.isArray(data.cards) || data.cards.length < 2 || data.cards.length > 10) {
            throw new Error('Carousel must have between 2 and 10 cards.');
        }

        // Validate consistency of header type
        const firstHeaderType = data.cards[0].headerType;
        const isConsistent = data.cards.every(card => card.headerType === firstHeaderType);
        if (!isConsistent) {
            throw new Error('All cards must have the same header type (image or video).');
        }

        // 2. Construct Cards
        const cards = data.cards.map((card, index) => {
            const cardObj = {
                card_index: index, // Ensure 0-9 index
                type: "cta_url",
                header: {
                    type: firstHeaderType.toLowerCase(),
                    [firstHeaderType.toLowerCase()]: {
                        link: card.mediaUrl
                    }
                },
                body: {
                    text: card.bodyText || " " // Body is optional but good to have
                },
                action: {
                    name: "cta_url",
                    parameters: {
                        display_text: card.buttonText,
                        url: card.buttonUrl
                    }
                }
            };
            return cardObj;
        });

        // 3. Construct Interactive Message
        const interactive = {
            type: "carousel",
            body: {
                text: data.body || "Check out these items"
            },
            action: {
                cards: cards
            }
        };

        // 4. Send Message via WhatsApp Service
        await whatsappService.sendMessage(user_id, contact_phone, 'interactive', interactive);

        console.log(`[Carousel] Sent to ${contact_phone}`);

        // 5. Return Result
        // Carousel messages (CTA URL) do not wait for a reply in the flow engine sense because the user leaves the app.
        // However, we might want to continue to the next node immediately.
        return {
            status: 'completed',
            next_node_id: node.data.nextId || null // Assuming we might add a "next" handle
        };

    } catch (error) {
        console.error('[Carousel Executor] Error:', error.response?.data || error.message);
        throw error;
    }
};

module.exports = { execute };
