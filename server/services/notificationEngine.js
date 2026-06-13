const { supabaseAdmin } = require('../lib/supabaseClient');
const whatsappService = require('./whatsappService');
const SmtpService = require('./SmtpService');
const axios = require('axios');

// Helper to parse template parameters
const parseTemplateComponents = (paramsJson, mediaUrl, userData) => {
    const components = [];
    
    if (mediaUrl) {
        components.push({
            type: 'header',
            parameters: [{ type: 'image', image: { link: mediaUrl } }]
        });
    }

    if (paramsJson && Array.isArray(paramsJson) && paramsJson.length > 0) {
        const bodyParams = paramsJson.map(param => {
            let textValue = '';
            if (param.type === 'field') {
                if (param.value === 'name') textValue = userData.name || '';
                else if (param.value === 'email') textValue = userData.email || '';
                else if (param.value === 'contact') textValue = userData.contact_number || '';
            } else if (param.type === 'custom') {
                textValue = param.value || '';
            }
            return { type: 'text', text: textValue };
        });
        
        components.push({
            type: 'body',
            parameters: bodyParams
        });
    }
    return components;
};

class NotificationEngine {
    
    async processSignupNotifications(domain, userData) {
        const { name, email, contact_number } = userData;

        if (!domain || !email) {
            console.error('NotificationEngine: Domain and email are required');
            return { error: 'Domain and email are required' };
        }

        let requestDomain = domain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com';
        }

        // Fetch settings for this domain
        const { data: settings } = await supabaseAdmin
            .from('tenant_notification_settings')
            .select('*')
            .eq('domain', requestDomain)
            .single();

        if (!settings) {
            return { success: true, message: 'No notification settings configured for this domain' };
        }

        let notificationsSent = 0;
        let integrationUserId = null;

        // Find the specific integration user if provided
        if (settings.integration_user_email) {
            const { data: intUser } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('email', settings.integration_user_email.trim())
                .eq('signup_domain', requestDomain)
                .single();
            
            if (intUser) {
                integrationUserId = intUser.id;
            } else {
                console.warn(`NotificationEngine: Integration User Email ${settings.integration_user_email} not found in domain ${requestDomain}.`);
            }
        }

        // Fallback: If no integration user configured or found, try to find any owner/admin
        if (!integrationUserId) {
            const { data: domainUsers } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', requestDomain)
                .in('role', ['owner', 'admin']);
            
            if (domainUsers && domainUsers.length > 0) {
                // Just take the first admin we find as fallback
                integrationUserId = domainUsers[0].id;
            }
        }

        // ==========================================
        // WEBHOOK NOTIFICATION
        // ==========================================
        if (settings.trigger_webhook_on_signup && settings.admin_webhook_url) {
            try {
                const payload = {
                    event: 'new_user_signup',
                    domain: requestDomain,
                    contact_phone: contact_number || '', // Added to match the active session requirement
                    admin: {
                        email: settings.admin_email_address || null,
                        whatsapp_number: settings.admin_whatsapp_number || null
                    },
                    user: {
                        name: name || 'N/A',
                        email: email,
                        contact_number: contact_number || 'N/A',
                    },
                    timestamp: new Date().toISOString()
                };

                await axios.post(settings.admin_webhook_url, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 5000 // 5 second timeout so it doesn't hang
                });
                
                notificationsSent++;
            } catch (err) {
                console.error(`NotificationEngine: Failed to trigger webhook at ${settings.admin_webhook_url}:`, err.message);
                // We do NOT throw here so other processes aren't blocked
            }
        }

        console.log(`NotificationEngine DEBUG: requestDomain='${requestDomain}', integrationUserId='${integrationUserId}'`);
        
        if (!integrationUserId) {
            console.warn(`NotificationEngine: No valid integration user or admins found for domain ${requestDomain}. Cannot send messages.`);
            return { success: true, message: 'Webhook triggered. No valid admins found for other messages.' };
        }

        // ==========================================
        // WHATSAPP NOTIFICATIONS
        // ==========================================
        const waNumberId = settings.whatsapp_api_number_id;

        if (waNumberId) {
            // 1. Send Welcome Message to New User
            if (settings.send_welcome_whatsapp && settings.welcome_template_name && contact_number) {
                try {
                    const components = parseTemplateComponents(settings.welcome_template_params, settings.welcome_template_media_url, userData);
                    const templateContent = {
                        name: settings.welcome_template_name,
                        language: { code: 'en' }, 
                        components
                    };

                    await whatsappService.sendMessage(
                        null, 
                        contact_number, 
                        'template', 
                        templateContent,
                        waNumberId,
                        true 
                    );
                    notificationsSent++;
                } catch (err) {
                    console.error('NotificationEngine: Failed to send welcome WhatsApp:', err.message);
                }
            }

            // 2. Notify Admin via WhatsApp
            if (settings.notify_admin_on_signup && settings.admin_whatsapp_number) {
                try {
                    let msgType = 'text';
                    let msgContent = {};

                    if (settings.admin_whatsapp_template_name) {
                        msgType = 'template';
                        const components = parseTemplateComponents(settings.admin_whatsapp_template_params, settings.admin_whatsapp_media_url, userData);
                        msgContent = {
                            name: settings.admin_whatsapp_template_name,
                            language: { code: 'en' },
                            components
                        };
                    } else {
                        const adminMsg = `New user signed up on ${requestDomain}:\nName: ${name || 'N/A'}\nEmail: ${email}\nContact: ${contact_number || 'N/A'}`;
                        msgContent = { body: adminMsg };
                    }
                    
                    await whatsappService.sendMessage(
                        null,
                        settings.admin_whatsapp_number,
                        msgType,
                        msgContent,
                        waNumberId,
                        true
                    );
                    notificationsSent++;
                } catch (err) {
                    console.error('NotificationEngine: Failed to send admin WhatsApp notification:', err.message);
                }
            }
        }

        // ==========================================
        // EMAIL NOTIFICATIONS
        // ==========================================
        if (settings.send_welcome_email || settings.notify_admin_via_email) {
            try {
                // Find SMTP integration for the specific integration user
                const { data: smtpIntegration } = await supabaseAdmin
                    .from('user_integrations')
                    .select('credentials')
                    .eq('user_id', integrationUserId)
                    .eq('provider', 'smtp')
                    .limit(1)
                    .single();

                if (smtpIntegration && smtpIntegration.credentials) {
                    const smtpConfig = smtpIntegration.credentials;

                    // Send Welcome Email
                    if (settings.send_welcome_email && email) {
                        try {
                            let subject = settings.welcome_email_subject || 'Welcome!';
                            let body = settings.welcome_email_body || 'Thanks for signing up!';

                            // Replace dynamic variables
                            const replacements = {
                                '{{name}}': name || 'User',
                                '{{email}}': email,
                                '{{domain}}': requestDomain,
                                '{{contact_number}}': contact_number || ''
                            };

                            for (const [key, value] of Object.entries(replacements)) {
                                const regex = new RegExp(key, 'gi');
                                subject = subject.replace(regex, value);
                                body = body.replace(regex, value);
                            }

                            await SmtpService.sendEmail(
                                smtpConfig,
                                smtpConfig.fromEmail,
                                email,
                                subject,
                                body
                            );
                            notificationsSent++;
                        } catch (err) {
                            console.error('NotificationEngine: Failed to send welcome email:', err.message);
                        }
                    }

                    // Notify Admin via Email
                    if (settings.notify_admin_via_email && settings.admin_email_address) {
                        try {
                            const adminHtml = `<h3>New User Signup</h3><p><strong>Domain:</strong> ${requestDomain}</p><p><strong>Name:</strong> ${name || 'N/A'}</p><p><strong>Email:</strong> ${email}</p><p><strong>Contact:</strong> ${contact_number || 'N/A'}</p>`;
                            await SmtpService.sendEmail(
                                smtpConfig,
                                smtpConfig.fromEmail,
                                settings.admin_email_address,
                                `New Signup on ${requestDomain}`,
                                adminHtml
                            );
                            notificationsSent++;
                        } catch (err) {
                            console.error('NotificationEngine: Failed to send admin email:', err.message);
                        }
                    }
                } else {
                    console.warn(`NotificationEngine: No SMTP integration found for integration user ${integrationUserId}. Skipping emails.`);
                }
            } catch (err) {
                console.error('NotificationEngine: Error processing email notifications:', err.message);
            }
        }

        return { success: true, notificationsSent };
    }
}

module.exports = new NotificationEngine();
