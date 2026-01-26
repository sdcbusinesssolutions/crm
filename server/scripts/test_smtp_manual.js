const nodemailer = require('nodemailer');

async function testSmtp() {
    console.log('Testing SMTP Connection...');

    // CONFIG FROM USER
    const config = {
        host: 'mail.upshopi.com',
        port: 465,
        secure: true, // SSL (Implicit TLS)
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        tls: {
            rejectUnauthorized: false
        }
    };

    try {
        const transporter = nodemailer.createTransport(config);

        // 1. Verify Connection
        console.log('Verifying connection...');
        await transporter.verify();
        console.log('Connection Verified Successfully!');

        // 2. Send Test Email
        console.log('Sending test email to kd31967@gmail.com...');
        const info = await transporter.sendMail({
            from: '"Upshopi Info" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'SMTP Test from AI Agent',
            text: 'This is a test email to verify the SMTP credentials.',
            html: '<b>This is a test email</b> to verify the SMTP credentials provided to the AI Agent.'
        });

        console.log('Message sent: %s', info.messageId);
        console.log('Test COMPLETE: SUCCESS');

    } catch (error) {
        console.error('Test FAILED:', error);
    }
}

testSmtp();
