const SettingsModel = require('../../models/admin/SettingsModel');

exports.getSettings = (req, res) => {
    res.json({
        general: {},
        payments: {
            stripe: { enabled: true },
            paypal: { enabled: false }
        },
        email: {},
        appearance: {}
    });
};

exports.updateSettings = (req, res) => { res.json({ message: 'Settings updated' }); };
