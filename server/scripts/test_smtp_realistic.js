const nodemailer = require('nodemailer');

async function testRealisticEmail() {
    console.log('Sending Realistic Email Test...');

    const config = {
        host: 'mail.upshopi.com',
        port: 465,
        secure: true, // SSL
        auth: {
            user: 'info@upshopi.com',
            pass: 'sonuDEV@2211'
        },
        tls: {
            // Do not fail on invalid certs
            rejectUnauthorized: false
        }
    };

    try {
        const transporter = nodemailer.createTransport(config);

        // Verify connection first
        await transporter.verify();
        console.log('SMTP Connection Verified.');

        const info = await transporter.sendMail({
            from: '"Upshopi Team" <info@upshopi.com>', // Professional Name
            to: 'kd31967@gmail.com',
            subject: 'Welcome to Upshopi Integration - Setup Confirmation', // Realistic Subject
            // Realistic Body to pass Spam Filters
            text: `Hello,

This is a confirmation that your SMTP integration setup for Upshopi was successful.

If you are receiving this email, it means your server is correctly configured to send outgoing emails.

Best regards,
The Upshopi Team`,
            html: `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 8px;">
                <h2 style="color: #4F46E5;">Integration Successful</h2>
                <p>Hello,</p>
                <p>This is a confirmation that your SMTP integration setup for <strong>Upshopi</strong> was successful.</p>
                <p style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 6px; color: #166534;">
                    ✅ <strong>System Check Passed:</strong> Outgoing mail server is responding.
                </p>
                <p>You can now confidently use this email channel for your automation flows.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
                <p style="font-size: 12px; color: #666;">
                    Sent automatically by Upshopi System.<br>
                    Time: ${new Date().toLocaleString()}
                </p>
            </div>
            `
        });

        console.log('--- SENT ---');
        console.log('Message ID:', info.messageId);
        console.log('Expected: Check Inbox AND Spam Folder for "Welcome to Upshopi"');

    } catch (error) {
        console.error('FAILED:', error);
    }
}

testRealisticEmail();
