const { supabaseAdmin } = require('../../lib/supabaseClient');

exports.getOnboardingSettings = async (req, res) => {
    try {
        // Use 'system' as the ID for global settings
        const SYSTEM_ID = 'system';

        const { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .select('*')
            .eq('user_id', SYSTEM_ID)
            .single();

        if (error && error.code !== 'PGRST116') throw error;

        // Return empty default if not found
        res.json(data || {
            manual_enabled: false,
            embedded_enabled: false,
            embedded_app_id: '',
            embedded_app_secret: '',
            embedded_config_id: ''
        });
    } catch (error) {
        console.error('Error fetching admin onboarding settings:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.updateOnboardingSettings = async (req, res) => {
    try {
        const SYSTEM_ID = 'system';

        const {
            manual_enabled,
            embedded_enabled,
            embedded_app_id,
            embedded_app_secret,
            embedded_config_id,
            bridge_domain
        } = req.body;

        // Upsert settings with system ID
        const { data, error } = await supabaseAdmin
            .from('onboarding_settings')
            .upsert({
                user_id: SYSTEM_ID,
                manual_enabled,
                embedded_enabled,
                embedded_app_id,
                embedded_app_secret,
                embedded_config_id,
                bridge_domain: bridge_domain || null,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' })
            .select()
            .single();

        if (error) throw error;

        res.json({ message: 'Onboarding settings updated successfully', data });
    } catch (error) {
        console.error('Error updating admin onboarding settings:', error);
        res.status(500).json({ error: error.message });
    }
};
