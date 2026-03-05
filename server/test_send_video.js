const fs = require('fs');
const path = require('path');
const whatsappService = require('./services/whatsappService');

async function testSend() {
    const userId = '38edee2f-04c5-4f4c-8ca1-baed6ed84711'; // Owner of ef801810-...
    const toPhone = '919373393645'; // Destination

    // The video provided by user
    const videoPath = path.join(__dirname, '..', '948262737855867-177261974930878.mp4');

    console.log("Reading video...", videoPath);
    const fileBuffer = fs.readFileSync(videoPath);

    try {
        console.log("1. Uploading to Meta as Media ID...");
        const mediaId = await whatsappService.uploadMediaToWhatsApp(
            userId,
            fileBuffer,
            'video/mp4',
            '948262737855867-177261974930878.mp4'
        );
        console.log("Uploaded successfully. Media ID:", mediaId);

        console.log("2. Sending message via ID...");
        const response = await whatsappService.sendMessage(
            userId,
            toPhone,
            'video',
            { id: mediaId },
            null,
            true // skipDBLog
        );
        console.log("Send successful!", response);
    } catch (err) {
        console.error("Test Error:", err);
    }
}

testSend();
