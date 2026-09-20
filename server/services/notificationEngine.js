const { supabaseAdmin } = require('../lib/supabaseClient');
const whatsappService = require('./whatsappService');
const SmtpService = require('./SmtpService');
const axios = require('axios');
const { notificationLogger: logger } = require('../utils/logger');

// Helper to parse template parameters
const parseTemplateComponents = (paramsJson, mediaUrl, userData, headerFormat, templateInfo) => {
    const components = [];

    if (headerFormat === 'CAROUSEL' || (templateInfo && templateInfo.template_type === 'CAROUSEL')) {
        const cards = (templateInfo?.buttons?.cards || []).map((card, idx) => {
            const cardComponents = [];
            if (mediaUrl) {
                let mediaType = 'image';
                if (card && card.header && card.header.format) {
                    const format = card.header.format.toUpperCase();
                    if (format === 'VIDEO') mediaType = 'video';
                    else if (format === 'DOCUMENT') mediaType = 'document';
                }
                cardComponents.push({
                    type: 'header',
                    parameters: [{ type: mediaType, [mediaType]: { link: mediaUrl } }]
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
                cardComponents.push({ type: 'body', parameters: bodyParams });
            }
            
            return {
                card_index: idx,
                components: cardComponents
            };
        });

        components.push({
            type: 'carousel',
            cards: cards
        });
        
        return components;
    }
    
    if (mediaUrl && headerFormat) {
        const typeMap = {
            'IMAGE': 'image',
            'VIDEO': 'video',
            'DOCUMENT': 'document'
        };
        const mediaType = typeMap[headerFormat] || 'image';

        components.push({
            type: 'header',
            parameters: [{ 
                type: mediaType, 
                [mediaType]: { link: mediaUrl } 
            }]
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
        try {
            const { name, email, contact_number } = userData;

            if (!domain || !email) {
                logger.error('NotificationEngine: Domain and email are required');
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
        if (settings.whatsapp_waba_id && settings.whatsapp_api_number_id) {
            const { data: configData } = await supabaseAdmin
                .from('whatsapp_config')
                .select('user_id')
                .eq('whatsapp_business_account_id', settings.whatsapp_waba_id.trim())
                .eq('phone_number_id', settings.whatsapp_api_number_id.trim())
                .limit(1)
                .maybeSingle();
            
            if (configData) {
                integrationUserId = configData.user_id;
            } else {
                logger.warn(`NotificationEngine: WhatsApp Config not found for WABA ${settings.whatsapp_waba_id}.`);
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



        logger.info(`NotificationEngine DEBUG: requestDomain='${requestDomain}', integrationUserId='${integrationUserId}'`);
        
        if (!integrationUserId) {
            logger.warn(`NotificationEngine: No valid integration user or admins found for domain ${requestDomain}. Cannot send messages.`);
            return { success: true, message: 'Webhook triggered. No valid admins found for other messages.' };
        }

        // ==========================================
        // WHATSAPP NOTIFICATIONS
        // ==========================================
        const waNumberId = settings.whatsapp_api_number_id;

        if (waNumberId) {
            // Helper to get template info
            const getTemplateInfo = async (templateName) => {
                try {
                    const { data } = await supabaseAdmin
                        .from('whatsapp_templates')
                        .select('language, header_format, template_type, buttons')
                        .eq('user_id', integrationUserId)
                        .eq('name', templateName)
                        .limit(1)
                        .maybeSingle();
                    return {
                        langCode: data?.language || 'en',
                        headerFormat: data?.header_format || data?.template_type || null,
                        template_type: data?.template_type,
                        buttons: data?.buttons
                    };
                } catch (e) {
                    return { langCode: 'en', headerFormat: null };
                }
            };

            // 1. Send Welcome Message to New User
            if (settings.send_welcome_whatsapp && settings.welcome_template_name && contact_number) {
                try {
                    const tInfo = await getTemplateInfo(settings.welcome_template_name);
                    const components = parseTemplateComponents(settings.welcome_template_params, settings.welcome_template_media_url, userData, tInfo.headerFormat, tInfo);
                    
                    const templateContent = {
                        name: settings.welcome_template_name,
                        language: { code: tInfo.langCode }, 
                        components
                    };

                    await whatsappService.sendMessage(
                        integrationUserId, 
                        contact_number, 
                        'template', 
                        templateContent,
                        waNumberId,
                        true 
                    );
                    logger.info('NotificationEngine: Successfully sent welcome WhatsApp', { target: contact_number, domain: requestDomain });
                    notificationsSent++;
                } catch (err) {
                    logger.error('NotificationEngine: Failed to send welcome WhatsApp:', { target: contact_number, domain: requestDomain, error: err.message });
                }
            }

            // 2. Notify Admin via WhatsApp
            if (settings.notify_admin_on_signup && settings.admin_whatsapp_number) {
                try {
                    let msgType = 'text';
                    let msgContent = {};

                    if (settings.admin_whatsapp_template_name) {
                        msgType = 'template';
                        const tInfo = await getTemplateInfo(settings.admin_whatsapp_template_name);
                        const components = parseTemplateComponents(settings.admin_whatsapp_template_params, settings.admin_whatsapp_media_url, userData, tInfo.headerFormat, tInfo);
                        
                        msgContent = {
                            name: settings.admin_whatsapp_template_name,
                            language: { code: tInfo.langCode },
                            components
                        };
                    } else {
                        const adminMsg = `New user signed up on ${requestDomain}:\nName: ${name || 'N/A'}\nEmail: ${email}\nContact: ${contact_number || 'N/A'}`;
                        msgContent = { body: adminMsg };
                    }
                    
                    await whatsappService.sendMessage(
                        integrationUserId,
                        settings.admin_whatsapp_number,
                        msgType,
                        msgContent,
                        waNumberId,
                        true
                    );
                    logger.info('NotificationEngine: Successfully sent admin WhatsApp notification', { target: settings.admin_whatsapp_number, domain: requestDomain });
                    notificationsSent++;
                } catch (err) {
                    logger.error('NotificationEngine: Failed to send admin WhatsApp notification:', { target: settings.admin_whatsapp_number, domain: requestDomain, error: err.message });
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
                            logger.info('NotificationEngine: Successfully sent welcome email', { target: email, domain: requestDomain });
                            notificationsSent++;
                        } catch (err) {
                            logger.error('NotificationEngine: Failed to send welcome email:', { target: email, domain: requestDomain, error: err.message });
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
                            logger.info('NotificationEngine: Successfully sent admin email', { target: settings.admin_email_address, domain: requestDomain });
                            notificationsSent++;
                        } catch (err) {
                            logger.error('NotificationEngine: Failed to send admin email:', { target: settings.admin_email_address, domain: requestDomain, error: err.message });
                        }
                    }
                } else {
                    logger.warn(`NotificationEngine: No SMTP integration found for integration user ${integrationUserId}. Skipping emails.`);
                }
            } catch (err) {
                logger.error('NotificationEngine: Error processing email notifications:', { error: err.message });
            }
        }

            return { success: true, notificationsSent };
        } catch (err) {
            logger.error('NotificationEngine: Critical error in processSignupNotifications:', { domain, email: userData?.email, error: err.message, stack: err.stack });
            return { error: 'Internal Notification Error' };
        }
    }
}

module.exports = new NotificationEngine();
