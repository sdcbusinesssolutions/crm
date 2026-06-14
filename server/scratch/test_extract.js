const tpl = {
    "id": "4b827457-6ce7-456c-b32a-56b618e9e377",
    "name": "uti",
    "template_type": "TEXT",
    "header_format": null,
    "header_text": "header",
    "body_text": "Hi {{1}}, thank you for your order!\r\nYour order {{2}} has been confirmed.\r\nWe’ll update you once it ships.",
    "footer_text": "from",
    "buttons": {
      "type": "NONE"
    }
};

const extractTemplateParams = (tpl) => {
    if (!tpl) return [];
    
    const components = tpl.components && tpl.components.length > 0 
        ? tpl.components 
        : [
            ...(tpl.body_text ? [{ type: 'BODY', text: tpl.body_text }] : []),
            ...(tpl.header_text || (tpl.template_type && tpl.template_type !== 'TEXT') 
                ? [{ 
                    type: 'HEADER', 
                    format: tpl.template_type === 'TEXT' || !tpl.template_type ? 'TEXT' : tpl.template_type, 
                    text: tpl.header_text 
                }] : []),
            ...(tpl.footer_text ? [{ type: 'FOOTER', text: tpl.footer_text }] : []),
            ...(tpl.buttons ? [
                tpl.buttons.type === 'MEDIA_CARD_CAROUSEL' 
                    ? { type: 'CAROUSEL', cards: tpl.buttons.cards }
                    : { type: 'BUTTONS', buttons: tpl.buttons.buttons || [] }
            ] : [])
        ];

    const params = [];

    components.forEach((c) => {
        if (c.type === 'HEADER') {
            if (c.format === 'IMAGE') params.push('HEADER_IMAGE');
            else if (c.format === 'VIDEO') params.push('HEADER_VIDEO');
            else if (c.format === 'DOCUMENT') params.push('HEADER_DOCUMENT');
            else if (c.format === 'TEXT' && c.text && c.text.includes('{{1}}')) {
                params.push('header_variable_1');
            }
        } else if (c.type === 'BODY' && c.text) {
            const matches = c.text.match(/{{(\d+)}}/g);
            if (matches) {
                const unique = Array.from(new Set(matches));
                unique.forEach((m) => {
                    const num = m.replace(/[^\d]/g, '');
                    params.push(`body_variable_${num}`);
                });
            }
        } else if (c.type === 'CAROUSEL' && c.cards) {
            // WhatsApp Carousel: Multiple Cards
            c.cards.forEach((card, cardIdx) => {
                const cardNum = cardIdx + 1;
                if (card.components) {
                    card.components.forEach((cardComp) => {
                        if (cardComp.type === 'HEADER') {
                            if (cardComp.format === 'IMAGE') params.push(`card_${cardNum}_image`);
                            else if (cardComp.format === 'VIDEO') params.push(`card_${cardNum}_video`);
                        } else if (cardComp.type === 'BODY' && cardComp.text) {
                            const cardMatches = cardComp.text.match(/{{(\d+)}}/g);
                            if (cardMatches) {
                                const cardUnique = Array.from(new Set(cardMatches));
                                cardUnique.forEach((m) => {
                                    const varNum = m.replace(/[^\d]/g, '');
                                    params.push(`card_${cardNum}_body_variable_${varNum}`);
                                });
                            }
                        }
                    });
                }
            });
        }
    });

    return Array.from(new Set(params));
};

console.log(extractTemplateParams(tpl));
