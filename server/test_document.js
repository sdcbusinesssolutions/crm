const fs = require('fs');
const path = require('path');
const whatsappService = require('./services/whatsappService');

async function testSend() {
    const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711';
    const toPhone = '910000000000';

    const videoPath = path.join(__dirname, '..', '948262737855867-177261974930878.mp4');
    const fileBuffer = fs.readFileSync(videoPath);

    try {
        console.log("1. Uploading to Meta as Document Media ID...");
        const mediaId = await whatsappService.uploadMediaToWhatsApp(
            userId,
            fileBuffer,
            'video/mp4', // we can keep mime type or use application/octet-stream
            '948262737855867-177261974930878.mp4'
        );
        console.log("Uploaded Document. Media ID:", mediaId);

        console.log("2. Sending message via ID AS DOCUMENT...");
        const response = await whatsappService.sendMessage(
            userId,
            toPhone,
            'document', // Force document type
            {
                id: mediaId,
                filename: '948262737855867-177261974930878.mp4',
                caption: 'Fallback: Sent as Document due to unsupported codec'
            },
            null,
            true
        );
        console.log("Send successful! WAMID: ", response.messages[0].id);

        fs.writeFileSync('test_wamid.txt', response.messages[0].id);
    } catch (err) {
        console.error("Test Error:", err);
    }
}

testSend();
