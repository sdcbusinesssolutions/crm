const { supabaseAdmin } = require('../../lib/supabaseClient');

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
