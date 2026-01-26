const nodemailer = require('nodemailer');

async function testSmtpNameFix() {
    console.log('--- TESTING SMTP WITH HELO NAME FIX ---');

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
        name: 'mail.upshopi.com', // FORCE HELO NAME
        debug: true,
        logger: true
    };

    try {
        const transporter = nodemailer.createTransport(config);

        console.log('1. Sending Mail (HELO fixed)...');
        const info = await transporter.sendMail({
            from: '"Upshopi Automation" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'SMTP Configuration Verification',
            text: 'This email is sent with the EHLO verification fix applied.',
            html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
                <h2 style="color: #2563eb;">Verification Email</h2>
                <p><strong>Config Status:</strong> HELO/EHLO identity set to <em>mail.upshopi.com</em></p>
                <p>This setting helps avoid "Spam" classification by matching the client hostname to the server.</p>
                <br/>
                <p style="font-size: 12px; color: #666;">Sent via Node.js Automation</p>
            </div>
            `
        });

        console.log('✅ Mail Sent with HELO Fix');
        console.log('Message ID:', info.messageId);

    } catch (e) {
        console.error('❌ TEST FAILED:', e);
    }
}

testSmtpNameFix();
