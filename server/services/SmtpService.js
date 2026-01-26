const nodemailer = require('nodemailer');

const SmtpService = {
    async createTransporter(config) {
        const port = parseInt(config.port);
        let secure = port === 465; // Default auto-detect
        let ignoreTLS = false;
        let requireTLS = false;

        if (config.encryption === 'ssl') {
            secure = true;
        } else if (config.encryption === 'tls') {
            secure = false;
            requireTLS = true;
        } else if (config.encryption === 'none') {
            secure = false;
            ignoreTLS = true;
        }

        return nodemailer.createTransport({
            host: config.host,
            port: port,
            secure: secure,
            auth: {
                user: config.user,
                pass: config.pass,
            },
            ignoreTLS: ignoreTLS,
            requireTLS: requireTLS,
            tls: {
                rejectUnauthorized: false
            },
            // Debugging enabled
            debug: true,
            logger: true,
            // HELO/EHLO Identity Fix: prevents 'localhost' being sent which triggers spam filters
            // We use the connected host as the client identity, which is generally accepted by shared hosting/cPanel 
            name: config.host
        });
    },

    async testConnection(config) {
        try {
            const transporter = await this.createTransporter(config);
            await transporter.verify();
            return { success: true };
        } catch (error) {
            console.error('SMTP Test Failed:', error);
            return { success: false, error: error.message };
        }
    },

    async sendEmail(config, fromEmail, to, subject, html) {
        try {
            const transporter = await this.createTransporter(config);
            const info = await transporter.sendMail({
                from: fromEmail || config.user, // Fallback to auth user
                to,
                subject,
                html
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('SMTP Send Failed:', error);
            throw error;
        }
    }
};

module.exports = SmtpService;
