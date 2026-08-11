const fs = require('fs');
const path = require('path');

const inboxTsxPath = path.join(__dirname, 'client/src/components/Inbox.tsx');
let inboxTsx = fs.readFileSync(inboxTsxPath, 'utf8');

// Replace tempId generator
inboxTsx = inboxTsx.replace(
    /const tempId = `temp-\$\{Date\.now\(\)\}-\$\{Math\.random\(\)\.toString\(36\)\.substr\(2, 9\)\}`;/g,
    "const tempId = crypto.randomUUID();"
);

// We need to pass the tempId as 'id' in sendMessage payload
// 1. Text message
inboxTsx = inboxTsx.replace(
    /const sentMsg = await inboxService\.sendMessage\(activeChatId, \{ text: textToSend, type: 'text' \}\);/g,
    "const sentMsg = await inboxService.sendMessage(activeChatId, { id: tempId, text: textToSend, type: 'text' });"
);

// 2. Location message
inboxTsx = inboxTsx.replace(
    /const sentMsg = await inboxService\.sendMessage\(activeChatId, \{\n\s*type: 'location',\n\s*latitude: locationInput\.lat,\n\s*longitude: locationInput\.lng,\n\s*name: locationInput\.name,\n\s*address: locationInput\.address\n\s*\}\);/g,
    "const sentMsg = await inboxService.sendMessage(activeChatId, {\n                            id: tempId,\n                            type: 'location',\n                            latitude: locationInput.lat,\n                            longitude: locationInput.lng,\n                            name: locationInput.name,\n                            address: locationInput.address\n                        });"
);

// 3. Media messages (Document/Image/Audio/Video)
inboxTsx = inboxTsx.replace(
    /const sentMsg = await inboxService\.sendMessage\(activeChatId, \{\n\s*type: activeAttachment\.type,\n\s*media_url: activeAttachment\.url,\n\s*text: attachmentCaption\n\s*\}\);/g,
    "const sentMsg = await inboxService.sendMessage(activeChatId, {\n                            id: tempId,\n                            type: activeAttachment.type,\n                            media_url: activeAttachment.url,\n                            text: attachmentCaption\n                        });"
);

// 4. Quick Reply (Template)
inboxTsx = inboxTsx.replace(
    /const sentMsg = await inboxService\.sendMessage\(activeChatId, \{\n\s*type: 'template',\n\s*name: templateName,\n\s*language: language,\n\s*components: components\n\s*\}\);/g,
    "const sentMsg = await inboxService.sendMessage(activeChatId, {\n                        id: tempId,\n                        type: 'template',\n                        name: templateName,\n                        language: language,\n                        components: components\n                    });"
);

// Replace state overwrite logic
const oldStateOverwrite = `
                    const existingRealMsg = prev.find(m => m.id === sentMsg.id);
                    if (existingRealMsg) {
                        return prev.filter(m => m.id !== tempId);
                    }
                    const updated = prev.map(m => m.id === tempId ? sentMsg : m);
                    return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
`;
const newStateOverwrite = `
                    const existingMsg = prev.find(m => m.id === tempId);
                    if (existingMsg && (existingMsg.status === 'read' || existingMsg.status === 'delivered')) {
                        // Socket.IO already updated the status, do not downgrade it back to 'sent'!
                        return prev;
                    }
                    const updated = prev.map(m => m.id === tempId ? sentMsg : m);
                    return updated.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
`;
inboxTsx = inboxTsx.split(oldStateOverwrite).join(newStateOverwrite);

fs.writeFileSync(inboxTsxPath, inboxTsx);
console.log("Inbox.tsx updated.");

const inboxJsPath = path.join(__dirname, 'server/routes/inbox.js');
let inboxJs = fs.readFileSync(inboxJsPath, 'utf8');

const oldNewMessage = `
        const newMessage = {
            conversation_id: conversationId,
`;
const newNewMessage = `
        const newMessage = {
            id: req.body.id || undefined,
            conversation_id: conversationId,
`;
inboxJs = inboxJs.replace(oldNewMessage, newNewMessage);

fs.writeFileSync(inboxJsPath, inboxJs);
console.log("inbox.js updated.");
