const nodemailer = require('nodemailer');

async function testSmtpVerbose() {
    console.log('Testing SMTP Connection (VERBOSE)...');

    const config = {
        host: 'mail.upshopi.com',
        port: 465,
        secure: true,
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        tls: {
            rejectUnauthorized: false
        },
        debug: true, // Show basic debug info
        logger: true // Log to console
    };

    try {
        const transporter = nodemailer.createTransport(config);

        console.log('--- SENDING ---');
        const info = await transporter.sendMail({
            from: '"Upshopi Test" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'SMTP Debug Test ' + new Date().toISOString(),
            text: 'Please confirm receipt of this email. Sent via Node.js debugging.',
            html: '<b>Please confirm receipt.</b><br/>Sent via Node.js debugging.'
        });

        console.log('--- RESULT ---');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('Accepted:', info.accepted);
        console.log('Rejected:', info.rejected);

    } catch (error) {
        console.error('--- ERROR ---');
        console.error(error);
    }
}

testSmtpVerbose();
