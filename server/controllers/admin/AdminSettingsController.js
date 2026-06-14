const { supabaseAdmin } = require('../../lib/supabaseClient');
const SmtpService = require('../../services/SmtpService');

exports.getOnboardingSettings = async (req, res) => {
    try {
        const SYSTEM_ID = 'system';

        // Multi-Tenancy: Get Domain
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'clickube.com'; // Default
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            } else {
                requestDomain = origin.split(':')[0];
            }
        } catch (e) { }

        // Normalize
        requestDomain = requestDomain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com'; // Fallback for local dev to Master
        }

        console.log(`[Settings] Fetching for domain: ${requestDomain}`);

        const { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', SYSTEM_ID)
            .eq('domain', requestDomain)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Return empty default if not found
        res.json(data || {
            manual_enabled: false,
            embedded_enabled: false,
            embedded_app_id: '',
            embedded_app_secret: '',
            embedded_config_id: '',
            bridge_domain: ''
        });
    } catch (error) {
        console.error('Error fetching admin onboarding settings:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateOnboardingSettings = async (req, res) => {
    try {
        const SYSTEM_ID = 'system';

        // Multi-Tenancy: Get Domain
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'clickube.com';
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            } else {
                requestDomain = origin.split(':')[0];
            }
        } catch (e) { }

        requestDomain = requestDomain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com';
        }

        const {
            manual_enabled,
            embedded_enabled,
            embedded_app_id,
            embedded_app_secret,
            embedded_config_id,
            bridge_domain
        } = req.body;

        console.log(`[Settings] Updating for domain: ${requestDomain}`);

        // Upsert settings with system ID + Domain
        const { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .upsert({
                user_id: SYSTEM_ID,
                domain: requestDomain, // ISOLATION KEY
                manual_enabled,
                embedded_enabled,
                embedded_app_id,
                embedded_app_secret,
                embedded_config_id,
                bridge_domain: bridge_domain || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id, domain' }) // Composite Unique Key
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Onboarding settings updated successfully', data });
    } catch (error) {
        console.error('Error updating admin onboarding settings:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSignupNotifications = async (req, res) => {
    try {
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'clickube.com';
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            } else {
                requestDomain = origin.split(':')[0];
            }
        } catch (e) { }

        requestDomain = requestDomain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com';
        }

        const { data, error } = await supabaseAdmin
            .from('tenant_notification_settings')
            .select('*')
            .eq('domain', requestDomain)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || {});
    } catch (error) {
        console.error('Error fetching admin signup notifications:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateSignupNotifications = async (req, res) => {
    try {
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'clickube.com';
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            } else {
                requestDomain = origin.split(':')[0];
            }
        } catch (e) { }

        requestDomain = requestDomain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com';
        }

        const payload = req.body;
        
        // Remove id and timestamps from payload if present so we don't try to update serials or read-only fields manually
        delete payload.id;
        delete payload.created_at;
        delete payload.updated_at;

        // --- VALIDATION: Prevent unauthorized WhatsApp Number ID usage ---
        if (payload.whatsapp_api_number_id || payload.whatsapp_waba_id) {
            let integrationUserId = null;
            
            // Determine the target user for this domain
            if (payload.integration_user_email) {
                const { data: intUser } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('email', payload.integration_user_email.trim())
                    .eq('signup_domain', requestDomain)
                    .single();
                if (intUser) integrationUserId = intUser.id;
            }

            if (!integrationUserId) {
                const { data: domainUsers } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('signup_domain', requestDomain)
                    .in('role', ['owner', 'admin'])
                    .limit(1);
                if (domainUsers && domainUsers.length > 0) integrationUserId = domainUsers[0].id;
            }

            if (!integrationUserId) {
                return res.status(400).json({ error: 'Cannot verify WhatsApp ID. No valid admin or integration user found for this domain.' });
            }

            // Verify ownership
            let query = supabaseAdmin
                .from('whatsapp_config')
                .select('phone_number_id, whatsapp_business_account_id')
                .eq('user_id', integrationUserId);

            if (payload.whatsapp_api_number_id) {
                query = query.eq('phone_number_id', payload.whatsapp_api_number_id);
            }
            if (payload.whatsapp_waba_id) {
                query = query.eq('whatsapp_business_account_id', payload.whatsapp_waba_id);
            }

            const { data: waConfig } = await query.maybeSingle();

            if (!waConfig) {
                return res.status(400).json({ 
                    error: 'Unauthorized: The provided WhatsApp API Number ID or WABA ID does not belong to your account. Please ensure you have connected this WhatsApp account correctly.' 
                });
            }
        }
        // --- END VALIDATION ---

        const { data, error } = await supabaseAdmin
            .from('tenant_notification_settings')
            .upsert({
                domain: requestDomain,
                ...payload,
                updated_at: new Date().toISOString()
            }, { onConflict: 'domain' })
            .select()
            .single();

        if (error) throw error;
        res.json({ message: 'Signup notifications updated successfully', data });
    } catch (error) {
        console.error('Error updating admin signup notifications:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getSmtpSettings = async (req, res) => {
    try {
        const adminEmail = req.admin.email;
        const requestDomain = req.admin.managed_domain;

        let userId = null;
        let { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', adminEmail)
            .single();
        if (profile) userId = profile.id;

        if (!userId) {
            const { data: domainUsers } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', requestDomain)
                .in('role', ['owner', 'admin'])
                .limit(1);
            if (domainUsers && domainUsers.length > 0) userId = domainUsers[0].id;
        }

        if (!userId) {
            return res.json({});
        }

        const { data, error } = await supabaseAdmin
            .from('user_integrations')
            .select('*')
            .eq('user_id', userId)
            .eq('provider', 'smtp')
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        
        if (data && data.credentials) {
            res.json(data.credentials);
        } else {
            res.json({});
        }
    } catch (error) {
        console.error('Error fetching SMTP settings:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateSmtpSettings = async (req, res) => {
    try {
        const adminEmail = req.admin.email;
        const requestDomain = req.admin.managed_domain;
        const payload = req.body;

        let userId = null;
        let { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('email', adminEmail)
            .single();
        if (profile) userId = profile.id;

        if (!userId) {
            const { data: domainUsers } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', requestDomain)
                .in('role', ['owner', 'admin'])
                .limit(1);
            if (domainUsers && domainUsers.length > 0) userId = domainUsers[0].id;
        }

        if (!userId) {
            return res.status(400).json({ error: 'Cannot save SMTP settings. No valid user account found for this domain. Please ensure at least one real user/admin account exists.' });
        }

        const { data: existingIntegration, error: fetchError } = await supabaseAdmin
            .from('user_integrations')
            .select('id')
            .eq('user_id', userId)
            .eq('provider', 'smtp')
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        let result;
        if (existingIntegration) {
            const { data, error } = await supabaseAdmin
                .from('user_integrations')
                .update({ credentials: payload, updated_at: new Date().toISOString() })
                .eq('id', existingIntegration.id)
                .select()
                .single();
            if (error) throw error;
            result = data;
        } else {
            const { data, error } = await supabaseAdmin
                .from('user_integrations')
                .insert({
                    user_id: userId,
                    provider: 'smtp',
                    credentials: payload
                })
                .select()
                .single();
            if (error) throw error;
            result = data;
        }

        res.json({ message: 'SMTP settings updated successfully', credentials: result.credentials });
    } catch (error) {
        console.error('Error updating SMTP settings:', error);
        res.status(500).json({ error: error.message, details: error.details });
    }
};

exports.testSmtpSettings = async (req, res) => {
    try {
        const { config, testEmail } = req.body;
        
        if (!config || !testEmail) {
            return res.status(400).json({ error: 'Config and test email are required' });
        }

        // Test connection
        const connectionResult = await SmtpService.testConnection(config);
        if (!connectionResult.success) {
            return res.status(400).json({ error: 'Connection failed: ' + connectionResult.error });
        }

        // Send test email
        const sendResult = await SmtpService.sendEmail(
            config,
            config.fromEmail || config.user,
            testEmail,
            'SMTP Configuration Test',
            '<p>Your SMTP configuration is working correctly!</p>'
        );

        res.json({ message: 'Test email sent successfully', success: true });
    } catch (error) {
        console.error('Error testing SMTP settings:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getIntegrationTemplates = async (req, res) => {
    try {
        const origin = req.headers.origin || req.headers.host || '';
        let requestDomain = 'clickube.com';
        try {
            if (origin.startsWith('http')) {
                requestDomain = new URL(origin).hostname;
            } else {
                requestDomain = origin.split(':')[0];
            }
        } catch (e) { }

        requestDomain = requestDomain.replace(/^www\./, '').toLowerCase();
        if (requestDomain.includes('localhost') || requestDomain.includes('127.0.0.1')) {
            requestDomain = 'clickube.com';
        }

        const wabaId = req.query.wabaId;
        const phoneId = req.query.phoneId;

        let integrationUserId = null;
        
        // Find user by WABA ID + Phone ID
        if (wabaId && phoneId) {
            const { data: configData } = await supabaseAdmin
                .from('whatsapp_config')
                .select('user_id')
                .eq('whatsapp_business_account_id', wabaId.trim())
                .eq('phone_number_id', phoneId.trim())
                .limit(1)
                .maybeSingle();
            if (configData) integrationUserId = configData.user_id;
        }

        // Fallback to any admin in domain if WABA ID fails or is missing
        if (!integrationUserId) {
            const { data: domainUsers } = await supabaseAdmin
                .from('profiles')
                .select('id')
                .eq('signup_domain', requestDomain)
                .in('role', ['owner', 'admin'])
                .limit(1);
            if (domainUsers && domainUsers.length > 0) integrationUserId = domainUsers[0].id;
        }

        if (!integrationUserId) {
            return res.json([]); // Return empty if no valid user found
        }

        const { data, error } = await supabaseAdmin
            .from('whatsapp_templates')
            .select('*')
            .eq('user_id', integrationUserId)
            .eq('status', 'APPROVED');

        if (error) throw error;

        res.json(data || []);
    } catch (error) {
        console.error('Error fetching admin whatsapp templates:', error);
        res.status(500).json({ error: error.message });
    }
};
