const nodemailer = require('nodemailer');

async function testSmtpTLS() {
    console.log('--- TESTING SMTP VIA TLS (STARTTLS) ---');

    const config = {
        host: 'mail.upshopi.com',
        port: 587, // Port for STARTTLS
        secure: false, // Must be false for STARTTLS
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        tls: {
            rejectUnauthorized: false
        },
        debug: true,
        logger: true
    };

    try {
        const transporter = nodemailer.createTransport(config);

        console.log('1. Verifying Connection (TLS)...');
        await transporter.verify();
        console.log('✅ TLS Connection Verified');

        console.log('2. Sending Mail (TLS)...');
        const info = await transporter.sendMail({
            from: '"Upshopi TLS Test" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'TLS Configuration Test',
            text: 'This email confirms that Port 587 (STARTTLS) is working correctly via Node.js.',
            html: '<b>TLS Connection Successful.</b><br>Port: 587<br>Secure: false'
        });

        console.log('✅ Mail Sent via TLS');
        console.log('Message ID:', info.messageId);

    } catch (e) {
        console.error('❌ TLS TEST FAILED:', e);
    }
}

testSmtpTLS();
