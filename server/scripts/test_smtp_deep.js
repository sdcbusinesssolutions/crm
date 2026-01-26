const nodemailer = require('nodemailer');

async function debugSmtpDeep() {
    console.log('--- STARTING DEEP DEBUG TEST ---');

    // Trying Port 587 (STARTTLS) often works better for Node.js than 465 on some cPanel hosts
    const config = {
        host: 'mail.upshopi.com',
        port: 465, // Let's stick to 465 as per their screenshot, IF that fails we try 587
        secure: true,
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        // Log EVERYTHING
        debug: true,
        logger: true,
        // Crucial for shared hosting
        tls: {
            rejectUnauthorized: false
        }
    };

    try {
        const transporter = nodemailer.createTransport(config);

        console.log('1. Verifying Connection...');
        await transporter.verify();
        console.log('✅ Connection Verified');

        console.log('2. Sending Mail...');
        const info = await transporter.sendMail({
            from: '"Upshopi Automation" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            replyTo: 'info@upshopi.com',
            subject: 'Final Verification Test: Node.js SMTP',
            text: 'This email proves that the Node.js application can send emails through your SMTP server.',
            html: `
                <div style="border: 1px solid #ddd; padding: 20px; font-family: sans-serif;">
                    <h2 style="color: green;">✔ SMTP Connection Successful</h2>
                    <p>If you are reading this, the integration works.</p>
                    <p><strong>Sent at:</strong> ${new Date().toLocaleString()}</p>
                    <p><strong>Server:</strong> mail.upshopi.com</p>
                </div>
            `
        });

        console.log('✅ Mail Sent Attempt Completed');
        console.log('MessageID:', info.messageId);
        console.log('Response:', info.response);

    } catch (e) {
        console.error('❌ FATAL ERROR:', e);
    }
}

debugSmtpDeep();
