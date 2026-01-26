const nodemailer = require('nodemailer');

async function testSmtp587() {
    console.log('Testing SMTP Port 587 (STARTTLS)...');

    const config = {
        host: 'mail.upshopi.com',
        port: 587,
        secure: false, // TLS requires secure:false
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

        console.log('--- SENDING 587 ---');
        const info = await transporter.sendMail({
            from: '"Upshopi TLS" <info@upshopi.com>',
            to: 'kd31967@gmail.com',
            subject: 'SMTP Test Port 587',
            text: 'Testing Port 587 Delivery',
            html: '<b>Testing Port 587 Delivery</b>'
        });

        console.log('--- RESULT 587 ---');
        console.log('Response:', info.response);

    } catch (error) {
        console.error('--- ERROR 587 ---');
        console.error(error);
    }
}

testSmtp587();
