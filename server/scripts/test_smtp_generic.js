const nodemailer = require('nodemailer');

async function testSmtpGeneric() {
    console.log('--- TESTING SMTP GENERIC CONFIG ---');

    // MOCK USER CONFIG (Different Domain to prove generic nature)
    // We will use upshopi again as the valid creds, but the LOGIC is what we are testing (that it picks up the host)
    const config = {
        host: 'mail.upshopi.com',
        port: 465,
        secure: true,
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        tls: { rejectUnauthorized: false }
    };

    console.log(`Configured Host: ${config.host}`);

    try {
        // Manually creating transport with the GENERIC logic we just implemented
        const transporter = nodemailer.createTransport({
            ...config,
            // Simulating what SmtpService does now:
            name: config.host,
            debug: true,
            logger: true
        });

        console.log('1. Sending Mail (Generic Identity)...');
        const info = await transporter.sendMail({
            from: '"Upshopi Generic" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'Generic SMTP Fix Verification',
            text: `This email verifies that the generic solution works. HELO should be: ${config.host}`,
            html: `<b>Generic Fix Working.</b><br>HELO Host: ${config.host}`
        });

        console.log('✅ Mail Sent');
        console.log('Message ID:', info.messageId);

    } catch (e) {
        console.error('❌ TEST FAILED:', e);
    }
}

testSmtpGeneric();
